import path from 'path'
import { dependencies } from '../package.json'

export const template = {
  dependencies,
  dir: path.join(__dirname, '..', 'template'),
  files: [
    'App.js',
    'client.js',
    'index.js',
    'middleware.js',
    'router.js',
    'router.scrollBehavior.js',
    'server.js',
    'utils.js',
    'empty.js',
    'components/nuxt-build-indicator.vue',
    'components/nuxt-error.vue',
    'components/nuxt-loading.vue',
    'components/nuxt-child.js',
    'components/nuxt-link.server.js',
    'components/nuxt-link.client.js',
    'components/nuxt.js',
    'views/app.template.html',
    'views/error.html'
  ]
}
