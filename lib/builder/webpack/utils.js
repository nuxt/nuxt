import { each } from 'lodash'

// https://stackoverflow.com/a/2008444
const identifierRegexp = /^[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*$/

export function fillEnv(src, dest, prefix) {
  each(src, (value, key) => {
    if (typeof value === 'object') {
      fillEnv(value, dest, prefix + notation(src, key))
    }
    dest[prefix + notation(src, key)] = (['boolean', 'number'].indexOf(typeof value) !== -1 ? value : JSON.stringify(value))
  })
}

function notation(src, key) {
  // bracket notation only for array keys
  if (Array.isArray(src)) {
    return '[' + key + ']'
  }

  // dot notation
  if (typeof key === 'string' && identifierRegexp.test(key)) {
    return '.' + key
  }

  // bracket notation
  return '[\'' + key + '\']'
}
