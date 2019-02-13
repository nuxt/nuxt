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
    'server.js',
    'utils.js',
    'empty.js',
    'mixins/async-data.client.js',
    'mixins/async-data.server.js',
    'mixins/fetch.server.js',
    'components/nuxt-error.vue',
    'components/nuxt-loading.vue',
    'components/nuxt-child.js',
    'components/nuxt-link.server.js',
    'components/nuxt-link.client.js',
    'components/nuxt.js',
    'components/no-ssr.js',
    'views/app.template.html',
    'views/error.html'
  ]
}
