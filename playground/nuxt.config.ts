import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineNuxtConfig({
  experimental: {
    typedPages: true
  },

  hooks: {
    'pages:extend' (pages) {
      console.log(`✅ Calling legacy pages:extend ${pages.length} pages`)
      console.log(pages.map(page => page.path))
    },
    'pages:beforeWrite' (rootPage) {
      rootPage.insert('_new_extend', resolve(__dirname, './pages/about.vue'))
    },
    'pages:extendOne' (page) {
      console.log('⚙️ extendOne', page.fullPath)
    }
  }
})
