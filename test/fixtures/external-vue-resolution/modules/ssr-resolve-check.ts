import { resolve } from 'node:path'
import { addVitePlugin, defineNuxtModule } from 'nuxt/kit'
import { resolveModulePath } from 'exsolve'

// Verifies that the SSR vite environment's resolved `resolve.conditions` are
// sufficient to resolve `vue` and `vue-router` from nuxt's own runtime files.
export default defineNuxtModule({
  meta: { name: 'ssr-resolve-check' },
  setup (_options, nuxt) {
    const importer = resolve(nuxt.options.appDir, 'entry.js')
    addVitePlugin({
      name: 'ssr-resolve-check',
      configResolved (config) {
        const ssr = config.environments?.ssr
        if (!ssr) { return }
        const conditions = ssr.resolve?.conditions
        if (!conditions) {
          throw new Error('SSR vite environment has no resolve.conditions configured. See https://github.com/nuxt/nuxt/issues/34888.')
        }
        for (const id of ['vue', 'vue-router']) {
          const resolved = resolveModulePath(id, { try: true, from: importer, conditions })
          if (!resolved) {
            throw new Error(`SSR vite resolve conditions ${JSON.stringify(conditions)} cannot resolve '${id}' from ${importer}. See https://github.com/nuxt/nuxt/issues/34888.`)
          }
        }
      },
    })
  },
})
