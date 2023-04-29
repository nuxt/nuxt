import { pathToFileURL } from 'node:url'
import { parseQuery, parseURL } from 'ufo'

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
