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

// `as const` keeps the tuple shape `defineDiagnostics` reads to type each
// reporter's call-site options; a plain array collapses them to `{}`.
// Colorize the terminal; tests stay plain. Bare `process.env.NODE_ENV` (no
// import) so the bundler can statically replace it.
// eslint-disable-next-line no-restricted-globals -- statically replaced at build time
export const reporters = [/* #__PURE__ */ (createConsoleReporter(process.env.NODE_ENV === 'test' ? undefined : { formatter: ansiFormatter(colors) }))] as const
