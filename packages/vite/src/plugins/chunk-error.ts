import MagicString from 'magic-string'
import type { Plugin } from 'vite'

const vitePreloadHelperId = '\0vite/preload-helper.js'

// TODO: remove this function when we upgrade to vite 5
export function chunkErrorPlugin (options: { sourcemap?: boolean }): Plugin {
  return {
    name: 'nuxt:chunk-error',
    transform (code, id) {
      // Vite 5 has an id with extension
      if (!(id === vitePreloadHelperId)) { return }

      const s = new MagicString(code)
      s.append(`
window.addEventListener('vite:preloadError', (event) => {
  useNuxtApp?.().callHook('app:chunkError', { error: event })
})
`)

      return {
        code: s.toString(),
        map: options.sourcemap
          ? s.generateMap({ hires: true })
          : undefined,
      }
    },
  }
}
