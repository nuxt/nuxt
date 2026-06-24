import { createConsoleReporter } from 'nostics'
import { ansiFormatter } from 'nostics/formatters/ansi'
import { colors } from 'consola/utils'

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
export const docsBase = (code: string): string =>
  `https://nuxt.com/docs/4.x/errors/${code.replace('NUXT_', '').toLowerCase()}`

// NB: `as const` (a readonly tuple) is required — `defineDiagnostics` extracts
// each reporter's call-site options by matching a tuple shape. A plain
// `DiagnosticReporter[]` (or an un-`as const` array) collapses the options to
// `{}`, so `diagnostics.CODE(p, { method: 'error' })` would stop type-checking.
//
// Build-time always runs in Node, so we colorize via the ansi formatter for a
// readable terminal; tests opt out (statically-analyzable `process.env.NODE_ENV`)
// so snapshots/assertions stay plain. consola's `colors` already no-op when the
// stream lacks color support (CI, piped output, NO_COLOR), so this stays quiet
// in non-interactive builds.
//
// Use the bare `process.env.NODE_ENV` global (no `node:process` import) so the
// bundler can statically replace it; importing `process` would defeat that.
// eslint-disable-next-line no-restricted-globals -- statically replaced at build time
export const reporters = [/* #__PURE__ */ (createConsoleReporter(process.env.NODE_ENV === 'test' ? undefined : { formatter: ansiFormatter(colors) }))] as const
