import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

export function unpatchedVue (): Plugin {
  return {
    name: 'test:unpatched-vue',
    enforce: 'pre',
    applyToEnvironment: environment => environment.name === 'client',
    resolveId (id) {
      // The pinned browser bundle keeps its runtime-core independent of workspace Vue upgrades.
      if (id === 'vue') {
        return fileURLToPath(import.meta.resolve('vue-unpatched/dist/vue.runtime.esm-browser.js'))
      }
    },
  }
}
