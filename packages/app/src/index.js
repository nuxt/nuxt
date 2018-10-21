import path from 'path'
import pkg from '../package.json'

export const meta = pkg

export const templatesDir = path.join(__dirname, '..', 'template')

export const templatesFiles = [
  'App.js',
  'client.js',
  'index.js',
  'middleware.js',
  'router.js',
  'server.js',
  'utils.js',
  'empty.js',
  'components/nuxt-error.vue',
  'components/nuxt-loading.vue',
  'components/nuxt-child.js',
  'components/nuxt-link.js',
  'components/nuxt.js',
  'components/no-ssr.js',
  'views/app.template.html',
  'views/error.html'
]
