import { colors } from 'consola/utils'
import { isAgent } from 'std-env'
import { createErrorUtils as createErrorUtilsBase, renderFrame, wrapLine } from '../../shared/src/error.ts'
import type { ErrorInfo, ErrorUtils, ErrorUtilsOptions, FrameConnectors } from '../../shared/src/error.ts'

export type { ErrorInfo, ErrorUtils, ErrorUtilsOptions } from '../../shared/src/error.ts'

const connectors: FrameConnectors = {
  mid: colors.dim('├▶'),
  end: colors.dim('╰▶'),
  pipe: colors.dim('│'),
  space: colors.dim('  '),
}

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1B\[[0-9;]*m/g, '')

const wrapOpts = { pipe: `\n${connectors.pipe}  `, stripAnsi }

function resolveDocsUrl (code: string, docsBase: ErrorUtilsOptions['docsBase']): string | undefined {
  return typeof docsBase === 'function'
    ? docsBase(code)
    : docsBase
      ? `${docsBase}/${code}`
      : undefined
}

function resolveCode (code: string, codePrefix: string | undefined): string {
  return codePrefix ? `${codePrefix}_${code}` : code
}

export function createErrorUtils (options: ErrorUtilsOptions): ErrorUtils {
  return createErrorUtilsBase({
    formatError: (item: ErrorInfo, opts: ErrorUtilsOptions): string => {
      const lines: string[] = []

      if (item.why) {
        lines.push(wrapLine(item.why, wrapOpts))
      }

      const docsUrl = item.docs || resolveDocsUrl(item.code, opts.docsBase)
      if (docsUrl) {
        lines.push(wrapLine(`${colors.bold('see:')} ${colors.underline(docsUrl)}`, wrapOpts))
      }

      if (item.fix) {
        lines.push(wrapLine(`${colors.bold('fix:')} ${item.fix}`, wrapOpts))
      }

      if (item.hint) {
        lines.push(wrapLine(`${colors.bold('hint:')} ${item.hint}`, wrapOpts))
      }

      if (item.sources) {
        for (const source of item.sources) {
          const loc = source.line != null
            ? `${source.file}:${source.line}${source.column != null ? `:${source.column}` : ''}`
            : source.file
          lines.push(wrapLine(`${colors.bold('source:')} ${loc}`, wrapOpts))
        }
      }

      const code = resolveCode(item.code, item.codePrefix || opts.prefix)
      let result = `${colors.bold(`[${code}]`)} ${item.message}`

      if (lines.length > 0) {
        result += '\n' + renderFrame(lines, connectors)
      }

      if (isAgent && item.context) {
        const entries = Object.entries(item.context)
          .map(([k, v]) => `  ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
          .join('\n')
        result += `\n\nDiagnostic context:\n${entries}`
      }

      return result
    },
    ...options,
  })
}
