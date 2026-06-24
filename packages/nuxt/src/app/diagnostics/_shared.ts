import { createConsoleReporter } from 'nostics'
import { ansiFormatter } from 'nostics/formatters/ansi'
import { createDevReporter } from 'nostics/reporters/dev'

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

// Minimal ANSI palette for server (Node) terminal output. We can't pull a color
// lib into the app bundle (browser import allowlist), but this is only ever
// referenced in the server, non-test branch below — the bundler tree-shakes it
// out of the client build where `import.meta.client` collapses the ternary to
// the default (plain) formatter. Server runtime report-only calls are
// dev-guarded, so escapes only ever reach a dev terminal.
const ansi = (open: number, close: number) => (s: string) => `\x1B[${open}m${s}\x1B[${close}m`
const colors = {
  red: ansi(31, 39),
  yellow: ansi(33, 39),
  cyan: ansi(36, 39),
  gray: ansi(90, 39),
  bold: ansi(1, 22),
  dim: ansi(2, 22),
}

// On the server (not browser) and outside tests we colorize via the ansi
// formatter; the browser console and test snapshots keep the plain default.
// The dev reporter forwards diagnostics to the Vite dev server (collector) and
// is added in dev only — in production `import.meta.dev` is false so the whole
// branch (and `createDevReporter`) tree-shakes away.
const devReporters = import.meta.dev ? [/* #__PURE__ */ (createDevReporter())] as const : [] as const

export const reporters = [
  /* #__PURE__ */ (createConsoleReporter(import.meta.client || import.meta.test ? undefined : { formatter: ansiFormatter(colors) })),
  ...devReporters,
] as const
