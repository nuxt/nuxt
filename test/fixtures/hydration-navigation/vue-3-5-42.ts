import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

export function vue3542 (): Plugin {
  return {
    name: 'test:vue-3-5-42',
    enforce: 'pre',
    applyToEnvironment: environment => environment.name === 'client',
    resolveId (id) {
      // The pinned browser bundle keeps its runtime-core independent of workspace Vue upgrades.
      if (id === 'vue') {
        return fileURLToPath(import.meta.resolve('vue-3-5-42/dist/vue.runtime.esm-browser.js'))
      }
    },
  }
}
