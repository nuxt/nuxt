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

const VUE_FILE_RE = /\.vue$/
const MACRO_QUERY_RE = /[?&]macro=/
const EXACT_MACRO_QUERY_RE = /\?macro=true$/
const VUE_QUERY_RE = /[?&]vue(?:&|$)/
const VUE_SCRIPT_BLOCK_RE = /[?&]vue&type=script\b/
const VUE_TEMPLATE_BLOCK_RE = /[?&]vue&type=template\b/

/**
 * Module id filters for Vue SFC requests, usable directly as `transform.filter.id`
 * includes. Each array matches whole `.vue` files, page-meta macro requests and the
 * relevant SFC block requests (`?vue&type=...` from `@vitejs/plugin-vue` and `vue-loader`).
 */
export const VUE_ID_FILTER = [VUE_FILE_RE, MACRO_QUERY_RE, VUE_QUERY_RE]
export const VUE_SCRIPT_ID_FILTER = [VUE_FILE_RE, MACRO_QUERY_RE, VUE_SCRIPT_BLOCK_RE]
export const VUE_TEMPLATE_ID_FILTER = [VUE_FILE_RE, EXACT_MACRO_QUERY_RE, VUE_TEMPLATE_BLOCK_RE]
export const VUE_SCRIPT_TEMPLATE_ID_FILTER = [VUE_FILE_RE, MACRO_QUERY_RE, VUE_SCRIPT_BLOCK_RE, VUE_TEMPLATE_BLOCK_RE]

/**
 * SFC block requests that never contain user script code but may carry a JS-like
 * extension in their query (e.g. `?vue&type=template&lang.js`). Use as an `exclude`
 * when combining `JS_ID_RE` with a filter that should not match template blocks.
 */
export const VUE_NON_SCRIPT_BLOCK_RE = /[?&]vue&type=(?:template|style|custom)\b/

export function isVue (id: string, opts: { type?: Array<'template' | 'script'> } = {}) {
  const filter = opts.type
    ? opts.type.includes('script')
      ? opts.type.includes('template') ? VUE_SCRIPT_TEMPLATE_ID_FILTER : VUE_SCRIPT_ID_FILTER
      : VUE_TEMPLATE_ID_FILTER
    : VUE_ID_FILTER
  return filter.some(re => re.test(id))
}

const JS_RE = /\.(?:[cm]?[jt]s|[jt]sx)$/

/** Like {@link isJS} but usable as an id filter (allows a query string after the extension). */
export const JS_ID_RE = /\.(?:[cm]?[jt]s|[jt]sx)(?:\?|$)/

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
