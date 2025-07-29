import { createDefu } from 'defu'
import type { ContentSecurityPolicyValue } from './types'

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

export async function generateHash (content: Buffer | string, hashAlgorithm: 'SHA-256' | 'SHA-384' | 'SHA-512') {
  let buffer: Uint8Array
  if (typeof content === 'string') {
    buffer = new TextEncoder().encode(content)
  } else {
    buffer = new Uint8Array(content)
  }
  const hashBuffer = await crypto.subtle.digest(hashAlgorithm, buffer)
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
  const prefix = hashAlgorithm.replace('-', '').toLowerCase()
  return `${prefix}-${base64}`
}
