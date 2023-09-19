import MagicString from 'magic-string'
import type { Plugin } from 'vite'

const vitePreloadHelperId = '\0vite/preload-helper'

// TODO: remove this function when we upgrade to vite 5
export function chunkErrorPlugin (options: { sourcemap?: boolean }): Plugin {
  return {
    name: 'nuxt:chunk-error',
    transform (code, id) {
      // Vite 5 has an id with extension
      if (!(id === vitePreloadHelperId || id === `${vitePreloadHelperId}.js`) || code.includes('nuxt.preloadError')) { return }

      const s = new MagicString(code)
      s.replace(/__vitePreload/g, '___vitePreload')
      s.append(`
export const __vitePreload = (...args) => ___vitePreload(...args).catch(err => {
  const e = new Event("nuxt.preloadError");
  e.payload = err;
  window.dispatchEvent(e);
  throw err;
})`)

      return {
        code: s.toString(),
        map: options.sourcemap
          ? s.generateMap({ hires: true })
          : undefined
      }
    }
  }
}
