import { extname } from 'pathe'

/**
 * Split a bundler module ID into its pathname and search (query) parts.
 *
 * Module IDs from Vite/webpack are already-normalized filesystem paths
 * that may carry query strings (e.g. `?vue&type=style&lang=css`).
 */
export function parseModuleId (id: string): { pathname: string, search: string } {
  const qIndex = id.indexOf('?')
  if (qIndex === -1) {
    return { pathname: id, search: '' }
  }
  return { pathname: id.slice(0, qIndex), search: id.slice(qIndex) }
}

const NUXT_COMPONENT_RE = /[?&]nuxt_component=/
const MACRO_RE = /[?&]macro=/
const VUE_QUERY_RE = /[?&]vue(?:&|$)/
const SETUP_QUERY_RE = /[?&]setup(?:=|&|$)/
const TYPE_QUERY_RE = /[?&]type=([^&]*)/

export function isVue (id: string, opts: { type?: Array<'template' | 'script' | 'style'> } = {}) {
  const { search } = parseModuleId(id)

  // Bare `.vue` file (in Vite)
  if (id.endsWith('.vue') && !search) {
    return true
  }

  if (!search) {
    return false
  }

  // Component async/lazy wrapper
  if (NUXT_COMPONENT_RE.test(search)) {
    return false
  }

  // Macro
  if (MACRO_RE.test(search) && (search === '?macro=true' || !opts.type || opts.type.includes('script'))) {
    return true
  }

  // Non-Vue or Styles
  if (!VUE_QUERY_RE.test(search)) {
    return false
  }

  if (opts.type) {
    const type = SETUP_QUERY_RE.test(search) ? 'script' : TYPE_QUERY_RE.exec(search)?.[1] as 'script' | 'template' | 'style' | undefined
    if (!type || !opts.type.includes(type)) {
      return false
    }
  }

  // Query `?vue&type=template` (in Webpack or external template)
  return true
}

const JS_RE = /\.(?:[cm]?j|t)sx?$/

/** Matches module IDs for Vue files (ignoring query strings). */
export const VUE_ID_RE = /\.vue(?:\?|$)/

export function isJS (id: string) {
  // JavaScript files
  const { pathname } = parseModuleId(id)
  return JS_RE.test(pathname)
}

export function getLoader (id: string): 'vue' | 'ts' | 'tsx' | null {
  const { pathname } = parseModuleId(id)
  const ext = extname(pathname)
  if (ext === '.vue') {
    return 'vue'
  }
  if (!JS_RE.test(ext)) {
    return null
  }
  return ext.endsWith('x') ? 'tsx' : 'ts'
}
