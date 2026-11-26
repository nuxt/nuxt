export interface ParamToken {
  name: string
  /** The custom regexp of the param, without its parentheses. */
  regexp: string
  repeatable: boolean
  optional: boolean
}
export type PathToken = string | ParamToken

const VALID_PARAM_RE = /\w/

/**
 * Splits a classic vue-router path into segments of static strings and params.
 * Port of `tokenizePath()` in vue-router's `pathTokenizer.ts`, keeping only what a matcher needs.
 */
export function tokenizeRoutePath (path: string): PathToken[][] {
  if (!path) { return [[]] }
  if (path === '/') { return [['']] }

  const segments: PathToken[][] = []
  let segment: PathToken[] = []
  let state: 'static' | 'param' | 'regexp' | 'regexp-end' | 'escape' = 'static'
  let previousState = state
  let buffer = ''
  let customRe = ''

  const consumeBuffer = (modifier = '') => {
    if (!buffer) { return }
    segment.push(state === 'static'
      ? buffer
      : { name: buffer, regexp: customRe, repeatable: modifier === '*' || modifier === '+', optional: modifier === '*' || modifier === '?' })
    buffer = ''
    customRe = ''
  }
  const finalizeSegment = (first = false) => {
    if (!first) { segments.push(segment) }
    segment = []
  }

  let first = true
  for (let i = 0; i < path.length;) {
    const char = path[i]!
    i++
    switch (state) {
      case 'static':
        if (char === '\\') {
          previousState = state
          state = 'escape'
        } else if (char === '/') {
          consumeBuffer()
          finalizeSegment(first)
          first = false
        } else if (char === ':') {
          consumeBuffer()
          state = 'param'
        } else {
          buffer += char
        }
        break
      case 'escape':
        buffer += char
        state = previousState
        break
      case 'param':
        if (char === '(') {
          state = 'regexp'
        } else if (VALID_PARAM_RE.test(char)) {
          buffer += char
        } else {
          const isModifier = char === '*' || char === '?' || char === '+'
          consumeBuffer(isModifier ? char : '')
          state = 'static'
          if (!isModifier) { i-- }
        }
        break
      case 'regexp':
        if (char === ')') {
          if (customRe.endsWith('\\')) {
            customRe = customRe.slice(0, -1) + char
          } else {
            state = 'regexp-end'
          }
        } else {
          customRe += char
        }
        break
      case 'regexp-end': {
        const isModifier = char === '*' || char === '?' || char === '+'
        consumeBuffer(isModifier ? char : '')
        state = 'static'
        if (!isModifier) { i-- }
        break
      }
    }
  }
  if (state === 'escape') { state = previousState }
  consumeBuffer()
  finalizeSegment()
  return segments
}
