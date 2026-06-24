import { createConsoleReporter } from 'nostics'

/**
 * Shared configuration for every build-time diagnostics catalog.
 *
 * Catalogs are split by domain (one file per `B<N>xxx` range) and imported
 * directly where they are used — there is intentionally no barrel re-exporting
 * them all, so a consumer only pulls in the codes it references.
 *
 * Codes are stable, fully-qualified `NUXT_B<NNNN>` identifiers. Codes that have
 * a dedicated docs page resolve a `see:` URL via {@link docsBase}; codes whose
 * inline why+fix is self-sufficient opt out with `docs: false` rather than ship
 * a link to a page that does not exist.
 */
export function docsBase (code: string): string {
  return `https://nuxt.com/docs/4.x/errors/${code.replace('NUXT_', '').toLowerCase()}`
}

// The `/* #__PURE__ */` annotation lets bundlers drop the reporter (and nostics)
// when every catalog using it is tree-shaken out. It lives on a hoisted const
// rather than inside the array literal so it survives `array-bracket-spacing`.
const consoleReporter = /* #__PURE__ */ createConsoleReporter()

// NB: `as const` (a readonly tuple) is required — `defineDiagnostics` extracts
// each reporter's call-site options by matching a tuple shape. A plain
// `DiagnosticReporter[]` (or an un-`as const` array) collapses the options to
// `{}`, so `diagnostics.CODE(p, { method: 'error' })` would stop type-checking.
export const reporters = [consoleReporter] as const
