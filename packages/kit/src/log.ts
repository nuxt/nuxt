import { colors } from 'consola/utils'
import { isAgent, isDebug } from 'std-env'
import { logger } from './logger.ts'
import * as errorCodes from './error-codes.ts'

import { createLog } from '../../shared/src/log.ts'
import type { Diagnostic } from '../../shared/src/log.ts'

export { createLog, interpolate, resolve } from '../../shared/src/log.ts'
export type { CreateLogOptions, Diagnostic, EmitContext, ErrorDefinition, Log } from '../../shared/src/log.ts'

export function formatDiagnostic (prefix: string, diag: Diagnostic, verbose: boolean): string {
  const lines = [`[${prefix}_${diag.code}] ${diag.message}`]

  if (diag.fix) { lines.push(` → ${colors.bold('fix:')} ` + diag.fix) }
  if (diag.hint) { lines.push(` → ${colors.bold('hint:')} ` + diag.hint) }
  if (diag.why) { lines.push(` → ${colors.bold('why:')} ` + diag.why) }
  if (diag.url) { lines.push(` → ${colors.bold('url:')} ` + diag.url) }
  if (verbose && diag.debug) {
    const entries = Object.entries(diag.debug)
      .map(([k, v]) => `  ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join('\n')
    lines.push(` → ${colors.bold('debug:')} ` + entries)
  }
  return lines.join('\n')
}

const verbose = isDebug || isAgent

export const nuxtBuildLog = createLog({
  prefix: 'NUXT',
  verbose,
  docs: code => `https://nuxt.com/e/${code}`,
  errors: errorCodes,
  onEmit (diag) {
    const msg = formatDiagnostic('NUXT', diag, verbose)
    if (diag.cause) { logger.warn(msg, diag.cause) } else { logger.warn(msg) }
  },
})
