import { colors } from 'consola/utils'
import { isAgent } from 'std-env'
import { createErrorUtils, renderFrame, wrapLine } from '../../shared/src/error.ts'
import type { FrameConnectors } from '../../shared/src/error.ts'
import { logger } from './logger.ts'

export type { ErrorOptions, ErrorUtils, ErrorUtilsOptions } from '../../shared/src/error.ts'
export { createErrorUtils } from '../../shared/src/error.ts'

/** @deprecated Use `ErrorOptions` instead. */
export type { ErrorOptions as NuxtErrorOptions } from '../../shared/src/error.ts'
/** @deprecated Use `ErrorUtils` instead. */
export type { ErrorUtils as BuildErrorUtils } from '../../shared/src/error.ts'
/** @deprecated Use `ErrorUtilsOptions` instead. */
export type { ErrorUtilsOptions as BuildErrorUtilsOptions } from '../../shared/src/error.ts'

const connectors: FrameConnectors = {
  mid: colors.dim('├▶'),
  end: colors.dim('╰▶'),
  pipe: colors.dim('│'),
  space: colors.dim('  '),
}

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1B\[[0-9;]*m/g, '')

export const buildErrorUtils = createErrorUtils({
  module: 'NUXT',
  docsBase: 'https://nuxt.com/e',
  logger,
  formatError: (message: string, opts): string => {
    const lines: string[] = []

    if (opts.why) {
      lines.push(wrapLine(opts.why, { pipe: `\n${connectors.pipe}  `, stripAnsi }))
    }

    if (opts.docsUrl) {
      lines.push(wrapLine(`${colors.bold('see:')} ${colors.underline(opts.docsUrl)}`, { pipe: `\n${connectors.pipe}  `, stripAnsi }))
    }

    if (opts.fix) {
      lines.push(wrapLine(`${colors.bold('fix:')} ${opts.fix}`, { pipe: `\n${connectors.pipe}  `, stripAnsi }))
    }

    let result = `${colors.bold(`[${opts.prefix}_${opts.code}]`)} ${message}`

    if (lines.length > 0) {
      result += '\n' + renderFrame(lines, connectors)
    }

    if (isAgent && opts.context) {
      const entries = Object.entries(opts.context)
        .map(([k, v]) => `  ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join('\n')
      result += `\n\nDiagnostic context:\n${entries}`
    }

    return result
  },
})
