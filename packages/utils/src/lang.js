export const encodeHtml = function encodeHtml(str) {
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export const isString = obj => typeof obj === 'string' || obj instanceof String
// 0, -0, null, false, NaN, undefined, or the empty string ("") 인지 아닌지
export const isNonEmptyString = obj => Boolean(obj && isString(obj))

export const isPureObject = function isPureObject(o) {
  // Array 아니고 오브젝트로 리턴하겠다,,
  return !Array.isArray(o) && typeof o === 'object'
}

export const isUrl = function isUrl(url) {
  // ['http', '//']의 하나가 url의 시작 부분이긴 한지
  return ['http', '//'].some(str => url.startsWith(str))
}

export const urlJoin = function urlJoin() {
  return [].slice
    .call(arguments)
    .join('/')
    .replace(/\/+/g, '/')
    .replace(':/', '://')
}

/**
 * Wraps value in array if it is not already an array
 *
 * @param  {any} value
 * @return {array}
 */
export const wrapArray = value => Array.isArray(value) ? value : [value]

const WHITESPACE_REPLACEMENTS = [
  [/[ \t\f\r]+\n/g, '\n'], // strip empty indents
  [/{\n{2,}/g, '{\n'], // strip start padding from blocks
  [/\n{2,}([ \t\f\r]*})/g, '\n$1'], // strip end padding from blocks
  [/\n{3,}/g, '\n\n'], // strip multiple blank lines (1 allowed)
  [/\n{2,}$/g, '\n'] // strip blank lines EOF (0 allowed)
]

export const stripWhitespace = function stripWhitespace(string) {
  WHITESPACE_REPLACEMENTS.forEach(([regex, newSubstr]) => {
    string = string.replace(regex, newSubstr)
  })
  return string
}
