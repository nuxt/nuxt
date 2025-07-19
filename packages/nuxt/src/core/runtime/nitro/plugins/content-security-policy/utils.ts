import { createDefu } from 'defu'
import type { ContentSecurityPolicyValue } from './types'

// These two lines are required only to maintain compatibility with Node 18
//  - In Node 19 and above, crypto is available in the global scope
//  - In Workers environments, crypto is available in the global scope
// eslint-disable-next-line import/order
import { webcrypto } from 'node:crypto'

globalThis.crypto ??= webcrypto as Crypto

export function headerStringFromObject (optionValue: ContentSecurityPolicyValue | false) {
  // False value translates into empty header
  if (optionValue === false) {
    return ''
  }
  // Stringify the options passed as a JS object
  return Object.entries(optionValue)
    .filter(([, value]) => value !== false)
    .map(([directive, sources]) => {
      if (directive === 'upgrade-insecure-requests') {
        return 'upgrade-insecure-requests;'
      } else {
        const stringifiedSources = (typeof sources === 'string')
          ? sources
          : (sources as string[])
              .map(source => source.trim())
              .join(' ')
        return `${directive} ${stringifiedSources};`
      }
    })
    .join(' ')
}

export const defuReplaceArray = createDefu((obj, key, value) => {
  if (Array.isArray(obj[key]) || Array.isArray(value)) {
    obj[key] = value
    return true
  }
})

export function generateRandomNonce () {
  const array = new Uint8Array(18)
  crypto.getRandomValues(array)
  const nonce = btoa(String.fromCharCode(...array))
  return nonce
}
