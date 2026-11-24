import { resolve } from 'pathe'
import type { Nuxt } from '@nuxt/schema'

export { getNameFromPath, hasSuffix, resolveComponentNameSegments } from './names.ts'
export { JS_ID_RE, VUE_FILE_RE, VUE_ID_FILTER, VUE_NON_SCRIPT_BLOCK_RE, VUE_SCRIPT_ID_FILTER, VUE_SCRIPT_TEMPLATE_ID_FILTER, VUE_TEMPLATE_ID_FILTER, getLoader, isJS, isVue, parseModuleId, vitestCacheKey } from './plugins.ts'

/**
 * Create a reporter that runs `report` once per `key` and `source`, so a diagnostic about a module
 * prints once however many bundles transform it, and again if the module changes. In development,
 * a change to the file on disk clears what was reported for it.
 */
export function createReportOnce (nuxt?: Nuxt) {
  const reported = new Map<string, string>()
  if (nuxt?.options.dev) {
    nuxt.hook('builder:watch', (_event, path) => {
      reported.delete(resolve(nuxt.options.srcDir, path))
    })
  }
  return (key: string, source: string, report: () => void) => {
    if (reported.get(key) === source) { return }
    reported.set(key, source)
    report()
  }
}

export function uniqueBy<T, K extends keyof T> (arr: T[], key: K) {
  if (arr.length < 2) {
    return arr
  }
  const res: T[] = []
  const seen = new Set<T[K]>()
  for (const item of arr) {
    if (seen.has(item[key])) { continue }
    seen.add(item[key])
    res.push(item)
  }
  return res
}

export const QUOTE_RE = /["']/g
export const EXTENSION_RE = /\b\.\w+$/g
export const SX_RE = /\.[tj]sx$/
