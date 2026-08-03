export { isVue, parseModuleId } from '../../../nuxt/src/core/utils/plugins.ts'
export { toVirtualId } from '../../../nuxt/src/core/plugins/virtual.ts'

// Copied from vue-bundle-renderer utils
export const IS_CSS_RE = /\.(?:css|scss|sass|postcss|pcss|less|stylus|styl)(?:\?[^.]+)?$/

export function isCSS (file: string) {
  return IS_CSS_RE.test(file)
}

/** @since 3.9.0 */
export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

// eslint-disable-next-line no-control-regex -- control characters are exactly what is being stripped
const INVALID_FILENAME_CHAR_RE = /[\u0000-\u001F"#$&*+,/:;<=>?@[\]^`{|}\u007F]+/g
const URI_ESCAPE_RE = /%../g
const QUERY_RE = /\?.*$/
const PATH_SEPARATOR_RE = /[/\\]/
const WINDOWS_DRIVE_RE = /^([A-Z])_\//i

/**
 * Replace characters that are not safe in a file name (or that would be interpreted as a
 * URI escape) with `_`, preserving a leading Windows drive letter.
 */
export function sanitizeFilePath (filePath = ''): string {
  return filePath
    .replace(QUERY_RE, '')
    .split(PATH_SEPARATOR_RE)
    .map(segment => segment.replace(INVALID_FILENAME_CHAR_RE, '_').replace(URI_ESCAPE_RE, '_'))
    .join('/')
    .replace(WINDOWS_DRIVE_RE, '$1:/')
}
