export { getNameFromPath, hasSuffix, resolveComponentNameSegments } from './names.ts'
export { JS_ID_RE, VUE_FILE_RE, VUE_ID_FILTER, VUE_NON_SCRIPT_BLOCK_RE, VUE_SCRIPT_ID_FILTER, VUE_SCRIPT_TEMPLATE_ID_FILTER, VUE_TEMPLATE_ID_FILTER, getLoader, isJS, isVue, parseModuleId } from './plugins.ts'

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
