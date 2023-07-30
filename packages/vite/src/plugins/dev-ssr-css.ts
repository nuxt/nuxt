import { joinURL } from 'ufo'
import type { Plugin } from 'vite'
import { isCSS } from '../utils'

interface DevStyleSSRPluginOptions {
  srcDir: string
  buildAssetsURL: string
}

export function devStyleSSRPlugin (options: DevStyleSSRPluginOptions): Plugin {
  return {
    name: 'nuxt:dev-style-ssr',
    apply: 'serve',
    enforce: 'post',
    transform (code, id) {
      if (!isCSS(id) || !code.includes('import.meta.hot')) {
        return
      }

      let moduleId = id
      if (moduleId.startsWith(options.srcDir)) {
        moduleId = moduleId.slice(options.srcDir.length)
      }

      // When dev `<style>` is injected, remove the `<link>` styles from manifest
      const selector = joinURL(options.buildAssetsURL, moduleId)
      return code + `\ndocument.querySelectorAll(\`link[href="${selector}"]\`).forEach(i=>i.remove())`
    }
  }
}
