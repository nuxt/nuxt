import { Plugin } from 'vite'
import { isCSS } from '../utils'

export function devStyleSSRPlugin (rootDir: string): Plugin {
  return {
    name: 'nuxt:dev-style-ssr',
    apply: 'serve',
    enforce: 'post',
    transform (code, id) {
      if (!isCSS(id) || !code.includes('import.meta.hot')) {
        return
      }

      let moduleId = id
      if (moduleId.startsWith(rootDir)) {
        moduleId = moduleId.slice(rootDir.length)
      }

      // When dev `<style>` is injected, remove the `<link>` styles from manifest
      // TODO: Use `app.assetsPath` or unique hash
      return code + `\ndocument.querySelectorAll(\`link[href="/_nuxt${moduleId}"]\`).forEach(i=>i.remove())`
    }
  }
}
