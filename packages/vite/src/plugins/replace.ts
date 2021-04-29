import type { Plugin } from 'vite'

export function replace (replacements: Record<string, string>) {
  return <Plugin>{
    name: 'nuxt:replace',
    transform (code) {
      Object.entries(replacements).forEach(([key, value]) => {
        const escapedKey = key.replace(/\./g, '\\.')
        code = code.replace(new RegExp(escapedKey, 'g'), value)
      })
      return {
        code,
        map: null
      }
    }
  }
}
