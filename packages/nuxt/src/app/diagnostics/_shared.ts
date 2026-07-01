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

// `as const` keeps the tuple shape `defineDiagnostics` reads to type each
// reporter's call-site options; a plain array collapses them to `{}`. The inline
// `/* #__PURE__ */` keeps the reporters tree-shakeable (`@stylistic/array-bracket-
// spacing` is disabled for this dir so its autofix can't strip it).

// Minimal ANSI palette: we can't import a color lib into the app bundle (browser
// allowlist), but this is only referenced in the server, non-test branch below,
// so it tree-shakes out of the client build.
const ansi = (open: number, close: number) => (s: string) => `\x1B[${open}m${s}\x1B[${close}m`
const colors = {
  red: ansi(31, 39),
  yellow: ansi(33, 39),
  cyan: ansi(36, 39),
  gray: ansi(90, 39),
  bold: ansi(1, 22),
  dim: ansi(2, 22),
}

// Dev reporter forwards to the Vite dev server; dev-only so it strips from prod.
const devReporters = import.meta.dev ? [/* #__PURE__ */ (createDevReporter())] as const : [] as const

export const reporters = [
  /* #__PURE__ */ (createConsoleReporter(import.meta.client || import.meta.test ? undefined : { formatter: ansiFormatter(colors) })),
  ...devReporters,
] as const
