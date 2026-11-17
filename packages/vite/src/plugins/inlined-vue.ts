import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'

/**
 * Resolves `vue` to its bundler build when a dev server environment inlines it.
 *
 * Vite externalises `vue` before plugins run if it resolves from the project root. If it does
 * not (e.g. an isolated `node_modules` where only Nuxt depends on it), its `node` entry is
 * inlined instead, and that re-exports a CommonJS build the module runner cannot evaluate.
 */
export function InlinedVuePlugin (nuxt: Nuxt): Plugin {
  return {
    name: 'nuxt:inlined-vue',
    enforce: 'pre',
    apply: 'serve',
    applyToEnvironment: environment => environment.config.consumer === 'server',
    resolveId: {
      filter: { id: /^vue$/ },
      handler (_id, importer) {
        const build = nuxt.options.vue.runtimeCompiler ? 'vue/dist/vue.esm-bundler.js' : 'vue/dist/vue.runtime.esm-bundler.js'
        return this.resolve(build, importer, { skipSelf: true })
      },
    },
  }
}
