// For pnpm typecheck:docs to generate correct types

import { fileURLToPath } from 'node:url'
import { addPluginTemplate, addRouteMiddleware, addVitePlugin } from 'nuxt/kit'

export default defineNuxtConfig({
  modules: [
    function () {
      if (!process.env.DOCS_TYPECHECK) { return }
      addPluginTemplate({
        filename: 'plugins/my-plugin.mjs',
        getContents: () => 'export default defineNuxtPlugin({ name: \'my-plugin\' })',
      })
      addRouteMiddleware({
        name: 'auth',
        path: '#build/auth.js',
      })
    },
    function (_options, nuxt) {
      // this preserves onPrehydrate so we can make assertions on the client
      nuxt.options.optimization.treeShake.composables.client ||= {}
      nuxt.options.optimization.treeShake.composables.client['#app'] = nuxt.options.optimization.treeShake.composables.client['#app']?.filter(c => c !== 'onPrehydrate') || []

      addVitePlugin(() => ({
        name: 'preserve-ssr-composables',
        enforce: 'pre',
        transform (code, id) {
          let replaced = false
          if (code.includes('export function onPrehydrate')) {
            replaced = true
            code = code.replaceAll('if (import.meta.client) { return }', '')
          }
          if (id.includes('nuxt-time.vue')) {
            replaced = true
            code = code.replace('if (import.meta.server) {', 'if (useAttrs().ssr) {')
          }
          if (replaced) {
            return code
          }
        },
      }))
    },
  ],
  pages: process.env.DOCS_TYPECHECK === 'true',
  dir: {
    app: fileURLToPath(new URL('./test/runtime/app', import.meta.url)),
  },
  vite: {
    define: {
      'import.meta.dev': 'globalThis.__TEST_DEV__',
    },
  },
  typescript: {
    shim: process.env.DOCS_TYPECHECK === 'true',
    hoist: ['@vitejs/plugin-vue', 'vue-router'],
  },
})
