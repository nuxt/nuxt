import { hasProtocol, joinURL } from 'ufo'

export const encodeHtml = function encodeHtml (str) {
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export const isString = obj => typeof obj === 'string' || obj instanceof String

export const isNonEmptyString = obj => Boolean(obj && isString(obj))

export const isPureObject = obj => !Array.isArray(obj) && typeof obj === 'object'

export const isUrl = function isUrl (url) {
  return hasProtocol(url, true)
}

export const urlJoin = joinURL

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
  [/^\n+/, ''], // strip blank lines at the beginning of a string
  [/\n{2,}$/, '\n'] // strip blank lines at the end of a string
]

export const stripWhitespace = function stripWhitespace (string) {
  WHITESPACE_REPLACEMENTS.forEach(([regex, newSubstr]) => {
    string = string.replace(regex, newSubstr)
  })
  return string
}
