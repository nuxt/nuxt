// For pnpm typecheck:docs to generate correct types

import { addPluginTemplate } from 'nuxt/kit'

export default defineNuxtConfig({
  typescript: { shim: process.env.DOCS_TYPECHECK === 'true' },
  pages: process.env.DOCS_TYPECHECK === 'true',
  modules: [
    function () {
      addPluginTemplate({
        filename: 'plugins/my-plugin.mjs',
        getContents: () => 'export default defineNuxtPlugin({ name: \'my-plugin\' })'
      })
    }
  ]
})
