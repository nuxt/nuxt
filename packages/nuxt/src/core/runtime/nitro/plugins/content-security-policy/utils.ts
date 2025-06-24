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
