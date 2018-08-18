import path from 'path'

export default {
  render: {
    dist: {
      maxAge: ((60 * 60 * 24 * 365) * 2)
    }
  },
  generate: {
    routes: [
      // TODO: generate with {build: false} does not scans pages!
      '/noloading',
      '/stateless',
      '/css',
      '/stateful',
      '/head',
      '/async-data',
      '/validate',
      '/redirect',

      '/users/1',
      '/users/2',
      { route: '/users/3', payload: { id: 3000 } }
    ],
    interval: 200,
    subFolders: true
  },
  head: {
    titleTemplate: (titleChunk) => {
      return titleChunk ? `${titleChunk} - Nuxt.js` : 'Nuxt.js'
    }
  },
  modulesDir: path.join(__dirname, '..', '..', '..', 'node_modules'),
  hooks: {
    ready(nuxt) {
      nuxt.__hook_called__ = true
    },
    bad: null,
    '': true
  },
  transition: false,
  build: {
    scopeHoisting: true,
    postcss: [
      require('postcss-preset-env')({
        features: {
          'custom-selectors': true
        }
      }),
      require('cssnano')
    ]
  }
}
