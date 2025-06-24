// For pnpm typecheck:docs to generate correct types

import { fileURLToPath } from 'node:url'
import { addPluginTemplate, addRouteMiddleware } from 'nuxt/kit'

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
  ],
  pages: process.env.DOCS_TYPECHECK === 'true',
  dir: {
    app: fileURLToPath(new URL('./test/runtime/app', import.meta.url)),
  },
  vite: {
    plugins: [
      {
        name: 'enable some dev logging',
        enforce: 'pre',
        transform (code) {
          if (code.includes('import.meta.dev /* and in test */')) {
            return code.replace('import.meta.dev /* and in test */', 'true')
          }
        },
      },
    ],
  },
  typescript: {
    shim: process.env.DOCS_TYPECHECK === 'true',
    hoist: ['@vitejs/plugin-vue', 'vue-router'],
  },
})
