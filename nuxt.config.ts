// For pnpm typecheck:docs to generate correct types

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
  typescript: {
    shim: process.env.DOCS_TYPECHECK === 'true',
    hoist: ['@vitejs/plugin-vue', 'vue-router'],
  },
})
