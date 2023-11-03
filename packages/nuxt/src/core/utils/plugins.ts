import { pathToFileURL } from 'node:url'
import { isAbsolute } from 'pathe'
import { parseQuery, parseURL } from 'ufo'

export function parseId (id: string) {
  id = id.replace(/^(virtual:nuxt:|virtual:)/, '')
  return parseURL(decodeURIComponent(isAbsolute(id) ? pathToFileURL(id).href : id))
}

export function isVue (id: string, opts: { type?: Array<'template' | 'script' | 'style'> } = {}) {
  // Bare `.vue` file (in Vite)
  const { search } = parseId(id)
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

const JS_RE = /\.((c|m)?j|t)sx?$/

export function isJS (id: string) {
  // JavaScript files
  const { pathname } = parseId(id)
  return JS_RE.test(pathname)
}
