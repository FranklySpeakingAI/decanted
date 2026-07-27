-- Decanted v2 schema (AUDIT-AND-REBUILD.md §2.3), adapted for the "no login"
-- decision: scans have no auth.users owner; the daily budget cap + per-IP rate
-- limit are the abuse controls. The app connects with the SERVICE ROLE key from
-- the server action, which bypasses RLS. RLS is still enabled with no public
-- policies so the anon/publishable key can read nothing.

create extension if not exists pg_trgm;

-- ── Canonical wine catalog (grows forever, one row per wine+vintage) ─────────
create table if not exists public.wines (
  id uuid primary key default gen_random_uuid(),
  canonical_key text unique not null,          -- slug(producer)|slug(name)|vintage
  name text not null,
  producer text,
  vintage int,                                 -- null = NV
  wine_type text not null check (wine_type in
    ('Red','White','Rosé','Champagne','Sparkling','Dessert','Non-Alcoholic')),
  region text not null default 'Other',
  country text,
  market_price_chf numeric,                    -- Swiss retail estimate; null = no data
  price_confidence text check (price_confidence in ('estimated','verified')),
  critic_score int check (critic_score between 80 and 100),
  food_pairings text[] not null default '{}',
  sommelier_note text,
  enriched_at timestamptz,
  enrichment_model text,                       -- audit: which model/source produced it
  created_at timestamptz not null default now()
);
create index if not exists wines_name_trgm on public.wines using gin (name gin_trgm_ops);
create index if not exists wines_producer_trgm on public.wines using gin (producer gin_trgm_ops);
create index if not exists wines_vintage on public.wines (vintage);

-- ── Scan cache: same document → same result, no API calls ────────────────────
create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  content_hash text not null,                  -- sha256 of normalized extracted text
  source_type text check (source_type in ('file','url')),
  source_ref text,                             -- filename or URL (no file contents stored)
  client_ip text,                              -- for optional history + rate-limit audit
  wine_count int,
  created_at timestamptz not null default now()
);
create index if not exists scans_hash on public.scans (content_hash);
create index if not exists scans_created on public.scans (created_at desc);

-- ── Line items: restaurant price per wine per scan (the data moat) ───────────
create table if not exists public.scan_wines (
  scan_id uuid not null references public.scans on delete cascade,
  wine_id uuid not null references public.wines,
  restaurant_price_chf numeric not null,
  raw_line text,                               -- original extracted text, for debugging matches
  primary key (scan_id, wine_id)
);

-- ── Spend ledger for the hard daily cap ──────────────────────────────────────
create table if not exists public.api_usage (
  id bigint generated always as identity primary key,
  day date not null default current_date,
  model text not null,
  step text,                                   -- 'extraction' | 'enrichment'
  input_tokens int not null,
  output_tokens int not null,
  cache_read_tokens int not null default 0,
  cache_write_tokens int not null default 0,
  estimated_cost_chf numeric not null,
  client_ip text,
  created_at timestamptz not null default now()
);
create index if not exists api_usage_day on public.api_usage (day);

-- ── Per-IP daily rate limit (replaces the in-memory Map) ─────────────────────
create table if not exists public.rate_limit (
  client_ip text not null,
  day date not null default current_date,
  count int not null default 0,
  primary key (client_ip, day)
);

-- ── RLS: lock all tables. Service role bypasses RLS; no public policies means
--    the anon/publishable key cannot read or write anything. ─────────────────
alter table public.wines enable row level security;
alter table public.scans enable row level security;
alter table public.scan_wines enable row level security;
alter table public.api_usage enable row level security;
alter table public.rate_limit enable row level security;

-- ── Atomic daily spend total for the budget gate (SECURITY DEFINER so it can
--    read api_usage regardless of caller; still only reachable via service key
--    in practice). ─────────────────────────────────────────────────────────
create or replace function public.daily_spend_chf(for_day date default current_date)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(estimated_cost_chf), 0) from public.api_usage where day = for_day;
$$;

-- ── Fuzzy catalog match: for each (name, vintage) input, return the best
--    trigram match whose vintage agrees (or both NV). One round trip for the
--    whole miss list. Exact canonical_key hits are done separately in the app. ─
create or replace function public.match_wines(
  p_names text[],
  p_vintages int[],
  p_threshold real default 0.55
)
returns table (
  idx int, id uuid, canonical_key text, name text, producer text, vintage int,
  wine_type text, region text, country text, market_price_chf numeric,
  price_confidence text, critic_score int, food_pairings text[], sommelier_note text
)
language sql
stable
security definer
set search_path = public
as $$
  select q.idx::int, m.id, m.canonical_key, m.name, m.producer, m.vintage, m.wine_type,
         m.region, m.country, m.market_price_chf, m.price_confidence, m.critic_score,
         m.food_pairings, m.sommelier_note
  from unnest(p_names, p_vintages) with ordinality as q(qname, qvintage, idx)
  cross join lateral (
    select w.* from public.wines w
    where similarity(w.name, q.qname) > p_threshold
      and (w.vintage = q.qvintage or (w.vintage is null and q.qvintage is null))
    order by similarity(w.name, q.qname) desc
    limit 1
  ) m;
$$;

-- ── Atomic per-IP rate-limit increment. Returns the new count for today.
--    Caller compares against its daily limit. ─────────────────────────────────
create or replace function public.bump_rate_limit(ip text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  insert into public.rate_limit (client_ip, day, count)
  values (ip, current_date, 1)
  on conflict (client_ip, day)
  do update set count = public.rate_limit.count + 1
  returning count into new_count;
  return new_count;
end;
$$;
