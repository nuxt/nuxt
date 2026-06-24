import { createConsoleReporter } from 'nostics'

/**
 * Shared configuration for the runtime (E<N>xxx) diagnostics catalogs.
 *
 * Catalogs are split by domain and imported directly where used — no barrel —
 * so the browser bundle only pulls in the codes a module references. Pair the
 * pure-call annotations on each `defineDiagnostics()` with dev-guarded,
 * statement-level report calls so report-only diagnostics strip from production.
 *
 * Codes are stable, fully-qualified `NUXT_E<NNNN>` identifiers. Codes with a
 * dedicated docs page resolve a `see:` URL via {@link docsBase}; the rest opt
 * out with `docs: false`.
 */
export function docsBase (code: string): string {
  return `https://nuxt.com/docs/4.x/errors/${code.replace('NUXT_', '').toLowerCase()}`
}

// The `/* #__PURE__ */` annotation lets bundlers drop the reporter (and nostics)
// from the browser bundle when every catalog using it is tree-shaken out. It
// lives on a hoisted const so it survives `array-bracket-spacing`.
const consoleReporter = /* #__PURE__ */ createConsoleReporter()

// NB: `as const` (a readonly tuple) is required so `defineDiagnostics` can
// extract the console reporter's per-call `method` option; a plain array
// collapses it to `{}` and `diagnostics.CODE(p, { method: 'error' })` stops
// type-checking.
export const reporters = [consoleReporter] as const
