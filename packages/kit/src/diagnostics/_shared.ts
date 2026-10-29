import process from 'node:process'

import { createConsoleReporter } from 'nostics'
import { ansiFormatter } from 'nostics/formatters/ansi'
import { colors } from 'consola/utils'

/**
 * Resolve the docs URL for a stable `NUXT_B<NNNN>` code.
 *
 * Codes with a dedicated docs page pass this as their `see:` URL; codes whose
 * inline why+fix is self-sufficient opt out with `docs: false`.
 */
export const docsBase = (code: string): string =>
  `https://nuxt.com/docs/5.x/errors/${code.replace('NUXT_', '').toLowerCase()}`

// `as const` preserves the tuple shape `defineDiagnostics` reads to type each
// reporter's call-site options; a plain array collapses them to `{}`.
export const reporters = [
  // Colorize the terminal; tests stay plain.
  /* #__PURE__ */ (createConsoleReporter(process.env.NODE_ENV === 'test' ? undefined : { formatter: ansiFormatter(colors) })),
] as const
