export { getNameFromPath, hasSuffix, resolveComponentNameSegments } from './names.ts'
export { getLoader, isJS, isVue, parseModuleId } from './plugins.ts'

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

export function truncateMiddle (str: string, maxLength: number): string {
  if (typeof str !== 'string' || str.length <= maxLength || maxLength <= 3) {
    return str
  }
  const charsToShow = Math.ceil((maxLength - 3) / 2)
  const backChars = Math.floor((maxLength - 3) / 2)
  return `${str.slice(0, charsToShow)}...${str.slice(str.length - backChars)}`
}
