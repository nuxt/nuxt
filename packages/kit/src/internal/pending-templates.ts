import process from 'node:process'

import { buildDiagnostics } from '../diagnostics/build.ts'

const pending = new Map<symbol, string>()

/** @internal */
export function reportPendingTemplates (): boolean {
  if (pending.size === 0) {
    return false
  }
  const filenames = [...new Set(pending.values())]
  buildDiagnostics.NUXT_B1022({
    count: filenames.length,
    templates: filenames.map(filename => `\`${filename}\``).join('\n  - '),
  }, { method: 'error' })
  process.exitCode ||= 1
  return true
}

process.on('beforeExit', reportPendingTemplates)

/**
 * Nothing else keeps the event loop alive during a build, so a template whose contents never
 * resolve would otherwise let the process drain and exit 0 with no output.
 *
 * @internal
 */
export async function trackPendingTemplate<T> (filename: string, getContents: () => T | Promise<T>): Promise<T> {
  const token = Symbol(filename)
  pending.set(token, filename)
  try {
    return await getContents()
  } finally {
    pending.delete(token)
  }
}
