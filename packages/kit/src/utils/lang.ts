export const encodeHtml = function encodeHtml (str: string) {
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export const isString = (obj: unknown): obj is string =>
  typeof obj === 'string' || obj instanceof String

export const isNonEmptyString = (obj: unknown): obj is string =>
  Boolean(obj && isString(obj))

export const isPureObject = (
  obj: unknown
): obj is Exclude<object, Array<any>> =>
  !Array.isArray(obj) && typeof obj === 'object'

export const isUrl = function isUrl (url: string) {
  return ['http', '//'].some(str => url.startsWith(str))
}

export const urlJoin = function urlJoin (...args: string[]) {
  return [].slice
    .call(args)
    .join('/')
    .replace(/\/+/g, '/')
    .replace(':/', '://')
}

/**
 * Wraps value in array if it is not already an array
 */
export const wrapArray = <T>(value: T | T[]): T[] =>
  Array.isArray(value) ? value : [value]

const WHITESPACE_REPLACEMENTS: [RegExp, string][] = [
  [/[ \t\f\r]+\n/g, '\n'], // strip empty indents
  [/{\n{2,}/g, '{\n'], // strip start padding from blocks
  [/\n{2,}([ \t\f\r]*})/g, '\n$1'], // strip end padding from blocks
  [/\n{3,}/g, '\n\n'], // strip multiple blank lines (1 allowed)
  [/\n{2,}$/g, '\n'] // strip blank lines EOF (0 allowed)
]

export const stripWhitespace = function stripWhitespace (string: string) {
  WHITESPACE_REPLACEMENTS.forEach(([regex, newSubstr]) => {
    string = string.replace(regex, newSubstr)
  })
  return string
}
