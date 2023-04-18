import { pathToFileURL } from 'node:url'
import { basename, extname } from 'pathe'
import { kebabCase, pascalCase } from 'scule'
import { parseQuery, parseURL } from 'ufo'

export function getNameFromPath (path: string) {
  return kebabCase(basename(path).replace(extname(path), '')).replace(/["']/g, '')
}

export function uniqueBy<T, K extends keyof T> (arr: T[], key: K) {
  const res: T[] = []
  const seen = new Set<T[K]>()
  for (const item of arr) {
    if (seen.has(item[key])) { continue }
    seen.add(item[key])
    res.push(item)
  }
  return res
}

export function hasSuffix (path: string, suffix: string) {
  return basename(path).replace(extname(path), '').endsWith(suffix)
}

export function getImportName (name: string) {
  return pascalCase(name).replace(/[^\w]/g, r => '_' + r.charCodeAt(0))
}

export function isVue (id: string, opts: { type?: Array<'template' | 'script' | 'style'> } = {}) {
  // Bare `.vue` file (in Vite)
  const { search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
  if (id.endsWith('.vue') && !search) {
    return true
  }

  if (!search) {
    return false
  }

  const query = parseQuery(search)

  // Macro
  if (query.macro && (!opts.type || opts.type.includes('script'))) {
    return true
  }

  // Non-Vue or Styles
  const type = 'setup' in query ? 'script' : query.type as 'script' | 'template' | 'style'
  if (!('vue' in query) || (opts.type && !opts.type.includes(type))) {
    return false
  }

  // Query `?vue&type=template` (in Webpack or external template)
  return true
}

const JS_RE = /\.((c|m)?j|t)sx?$/

export function isJS (id: string) {
  // JavaScript files
  const { pathname } = parseURL(decodeURIComponent(pathToFileURL(id).href))
  return JS_RE.test(pathname)
}
