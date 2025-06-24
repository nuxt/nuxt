export { isVue } from '../../../nuxt/src/core/utils/plugins'

// Copied from vue-bundle-renderer utils
const IS_CSS_RE = /\.(?:css|scss|sass|postcss|pcss|less|stylus|styl)(?:\?[^.]+)?$/

export function isCSS (file: string) {
  return IS_CSS_RE.test(file)
}

/** @since 3.9.0 */
export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}
