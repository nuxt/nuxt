import { pathToFileURL } from 'node:url'
import { hash } from 'ohash'
import { parseQuery, parseURL } from 'ufo'

export function uniq<T> (arr: T[]): T[] {
  return Array.from(new Set(arr))
}

// Copied from vue-bundle-renderer utils
const IS_CSS_RE = /\.(?:css|scss|sass|postcss|less|stylus|styl)(\?[^.]+)?$/

export function isCSS (file: string) {
  return IS_CSS_RE.test(file)
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

  // Component async/lazy wrapper
  if (query.nuxt_component) {
    return false
  }

  // Macro
  if (query.macro && (search === '?macro=true' || !opts.type || opts.type.includes('script'))) {
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

export function hashId (id: string) {
  return '$id_' + hash(id)
}

export function matchWithStringOrRegex (value: string, matcher: string | RegExp) {
  if (typeof matcher === 'string') {
    return value === matcher
  } else if (matcher instanceof RegExp) {
    return matcher.test(value)
  }

  return false
}

export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}
