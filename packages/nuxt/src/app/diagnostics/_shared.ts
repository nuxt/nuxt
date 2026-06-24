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

// NB: `as const` (a readonly tuple) is required so `defineDiagnostics` can
// extract the console reporter's per-call `method` option; a plain array
// collapses it to `{}` and `diagnostics.CODE(p, { method: 'error' })` stops
// type-checking.
//
// The inline `/* #__PURE__ */` keeps the reporter (and nostics) tree-shakeable
// from the browser bundle when every catalog is unused. `@stylistic/array-
// bracket-spacing` is disabled for this dir (see eslint.config.mjs) so its
// autofix can't strip the comment.
export const reporters = [/* #__PURE__ */ (createConsoleReporter())] as const
