import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

export function unpatchedVue (): Plugin {
  return {
    name: 'test:unpatched-vue',
    enforce: 'pre',
    applyToEnvironment: environment => environment.name === 'client',
    resolveId (id) {
      // The browser bundle contains its own runtime-core, untouched by the workspace patch.
      if (id === 'vue') {
        // TODO: When upgrading workspace Vue, resolve a separately pinned 3.5.42 bundle to retain old-Vue coverage.
        return fileURLToPath(import.meta.resolve('vue/dist/vue.runtime.esm-browser.js'))
      }
    },
  }
}
