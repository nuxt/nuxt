import type { Plugin } from 'vite'

const needsJsxProcessing = (id: string = '') =>
  !id.includes('node_modules') && ['.vue', '.jsx', '.tsx'].some(extension => id.includes(extension))

export function jsxPlugin () {
  return <Plugin>{
    name: 'nuxt:jsx',
    transform (code, id) {
      if (!needsJsxProcessing(id)) {
        return null
      }

      return {
        code: code.replace(/render\s*\(\s*\)\s*\{/g, 'render(h){'),
        map: null
      }
    }
  }
}
