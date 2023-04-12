import { resolve } from 'node:path'

export default defineNuxtConfig({
  experimental: {
    typedPages: true
  },

  hooks: {
    'pages:extend_legacy' (pages) {
      console.log(`✅ Calling legacy pages:extend ${pages.length} pages`)
      console.log(pages.map(page => page.fullPath))
    },
    'pages:beforeWrite' (rootPage) {
      rootPage.insert('_new_extend', resolve('./pages/about.vue'))
    },
    'pages:extend' (page) {
      console.log('⚙️ page', page.fullPath)
    }
  }
})
