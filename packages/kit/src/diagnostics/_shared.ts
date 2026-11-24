import process from 'node:process'

import { createConsoleReporter } from 'nostics'
import type { ConsoleMethod, DiagnosticReporter } from 'nostics'
import { ansiFormatter } from 'nostics/formatters/ansi'
import { colors } from 'consola/utils'

import kit from '../../package.json' with { type: 'json' }
import { logger } from '../logger.ts'

const majorVersion = Number.parseInt(kit.version, 10)

/**
 * Resolve the docs URL for a stable `NUXT_B<NNNN>` code.
 *
 * Codes with a dedicated docs page pass this as their `see:` URL; codes whose
 * inline why+fix is self-sufficient opt out with `docs: false`.
 */
export const docsBase = (code: string): string =>
  `https://nuxt.com/docs/${majorVersion}.x/errors/${code.replace('NUXT_', '').toLowerCase()}`

/** Set on a diagnostic once it has been printed, so that whatever catches it can skip printing it again. */
const reported = Symbol.for('nuxt.diagnostic.reported')

const formatter = /* #__PURE__ */ ansiFormatter(colors)

// Tests stay plain and observable through `console`.
const consoleReporter = process.env.NODE_ENV === 'test' ? /* #__PURE__ */ createConsoleReporter() : undefined

const reporter: DiagnosticReporter<{ method?: ConsoleMethod }> = (diagnostic, options) => {
  if (consoleReporter) {
    consoleReporter(diagnostic, options)
  } else {
    // renders the same whether or not `console` is wrapped by the logger
    logger[options?.method ?? 'warn'](formatter(diagnostic))
  }
  Object.defineProperty(diagnostic, reported, { value: true })
}

// `as const` preserves the tuple shape `defineDiagnostics` reads to type each
// reporter's call-site options; a plain array collapses them to `{}`.
export const reporters = [reporter] as const
