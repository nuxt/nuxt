
import MagicString from 'magic-string'
import type { Plugin } from 'vite'

export function chunkErrorPlugin (options: { sourcemap?: boolean }): Plugin {
  return {
    name: 'nuxt:chunk-error',
    transform (code, id) {
      if (id !== '\0vite/preload-helper' || code.includes('nuxt.preloadError')) { return }

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
          ? s.generateMap({ source: id, includeContent: true })
          : undefined
      }
    }
  }
}
