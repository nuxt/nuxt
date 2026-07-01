export type VueRouterPathToken = VueRouterPathStaticToken | VueRouterPathParamToken

export interface VueRouterPathStaticToken {
  type: 'static'
  value: string
}

export interface VueRouterPathParamToken {
  type: 'param'
  regexp?: string
  value: string
  optional: boolean
  repeatable: boolean
}

type TokenizerState = 'static' | 'param' | 'param-regexp' | 'param-regexp-end' | 'escape-next'

// Adapted from Vue Router's internal path tokenizer:
// https://github.com/vuejs/router/blob/v5.1.0/packages/router/src/matcher/pathTokenizer.ts
// TODO: replace this file if Vue Router exposes path tokens publicly.
export function tokenizePath (path: string): VueRouterPathToken[][] {
  if (!path) { return [[]] }
  if (path === '/') { return [[{ type: 'static', value: '' }]] }
  if (!path.startsWith('/')) {
    throw new Error(`Route paths should start with a "/": "${path}" should be "/${path}".`)
  }

  let state: TokenizerState = 'static'
  let previousState = state
  const tokens: VueRouterPathToken[][] = []
  let segment: VueRouterPathToken[] | undefined
  let i = 0
  let char = ''
  let buffer = ''
  let customRe = ''

  function crash (message: string) {
    throw new Error(`ERR (${state})/"${buffer}": ${message}`)
  }

  function finalizeSegment () {
    if (segment) {
      tokens.push(segment)
    }
    segment = []
  }

  function consumeBuffer () {
    if (!buffer) { return }

    segment ||= []

    if (state === 'static') {
      segment.push({ type: 'static', value: buffer })
    } else if (state === 'param' || state === 'param-regexp' || state === 'param-regexp-end') {
      if (segment.length > 1 && (char === '*' || char === '+')) {
        crash(`A repeatable param (${buffer}) must be alone in its segment. eg: '/:ids+.`)
      }
      segment.push({
        type: 'param',
        value: buffer,
        regexp: customRe,
        repeatable: char === '*' || char === '+',
        optional: char === '*' || char === '?',
      })
    } else {
      crash('Invalid state to consume buffer')
    }
    buffer = ''
  }

  while (i < path.length) {
    char = path[i++]!

    switch (state) {
      case 'static':
        if (char === '\\') {
          previousState = state
          state = 'escape-next'
        } else if (char === '/') {
          consumeBuffer()
          finalizeSegment()
        } else if (char === ':') {
          consumeBuffer()
          state = 'param'
        } else {
          buffer += char
        }
        break

      case 'escape-next':
        buffer += char
        state = previousState
        break

      case 'param':
        if (char === '(') {
          state = 'param-regexp'
        } else if (isValidParamChar(char)) {
          buffer += char
        } else {
          consumeBuffer()
          state = 'static'
          if (char !== '*' && char !== '?' && char !== '+') {
            i--
          }
        }
        break

      case 'param-regexp':
        if (char === ')') {
          if (customRe[customRe.length - 1] === '\\') {
            customRe = customRe.slice(0, -1) + char
          } else {
            state = 'param-regexp-end'
          }
        } else {
          customRe += char
        }
        break

      case 'param-regexp-end':
        consumeBuffer()
        state = 'static'
        if (char !== '*' && char !== '?' && char !== '+') {
          i--
        }
        customRe = ''
        break
    }
  }

  if (state === 'param-regexp') {
    crash(`Unfinished custom RegExp for param "${buffer}"`)
  }

  consumeBuffer()
  finalizeSegment()

  return tokens
}

function isValidParamChar (char: string) {
  const code = char.charCodeAt(0)
  return (code >= 65 && code <= 90) // A-Z
    || (code >= 97 && code <= 122) // a-z
    || (code >= 48 && code <= 57) // 0-9
    || char === '_'
}
