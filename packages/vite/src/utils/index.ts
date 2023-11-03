import { pathToFileURL } from 'node:url'
import { hash } from 'ohash'
import { isAbsolute } from 'pathe'
import { parseURL } from 'ufo'

export function uniq<T> (arr: T[]): T[] {
  return Array.from(new Set(arr))
}

// Copied from vue-bundle-renderer utils
const IS_CSS_RE = /\.(?:css|scss|sass|postcss|less|stylus|styl)(\?[^.]+)?$/

export function isCSS (file: string) {
  return IS_CSS_RE.test(file)
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

export function parseId (id: string) {
  id = id.replace(/^(virtual:nuxt:|virtual:)/, '')
  return parseURL(decodeURIComponent(isAbsolute(id) ? pathToFileURL(id).href : id))
}
