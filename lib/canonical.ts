// Canonical key shared by the runtime pipeline and the retailer prefill loader,
// so a scanned wine and a catalog wine hash to the same key.

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// canonical_key = slug(producer)|slug(name)|vintage
export function canonicalKey(
  producer: string | null | undefined,
  name: string,
  vintage: number | null,
): string {
  return `${slugify(producer ?? "")}|${slugify(name)}|${vintage ?? "nv"}`
}
