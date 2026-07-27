// Math.sumPrecise polyfill.
//
// unpdf bundles a pdf.js build (node_modules/unpdf/dist/pdfjs.mjs) that calls
// Math.sumPrecise during text extraction. It's a Stage-3 TC39 proposal not yet
// shipped in any Node release (including the Vercel runtime), so the call throws
// "Math.sumPrecise is not a function"; pdf.js swallows it and returns degraded
// text — dropping wines from the extracted list. Install a compensated-sum
// implementation before any PDF parsing runs.
//
// Import this module for its side effect (`import "@/lib/polyfills"`) at the top
// of every entry point that parses PDFs, so it is installed at module load,
// before the dynamic `import("unpdf")`.
if (typeof (Math as unknown as { sumPrecise?: unknown }).sumPrecise !== "function") {
  Object.defineProperty(Math, "sumPrecise", {
    // Neumaier (Kahan–Babuška) compensated summation — matches the spec's intent
    // of a precise sum without float drift. Good enough for pdf.js geometry.
    value: function sumPrecise(iterable: Iterable<number>): number {
      let sum = 0
      let compensation = 0 // running lost low-order bits
      for (const value of iterable) {
        const n = Number(value)
        const t = sum + n
        compensation += Math.abs(sum) >= Math.abs(n) ? sum - t + n : n - t + sum
        sum = t
      }
      return sum + compensation
    },
    writable: true,
    configurable: true,
  })
}
