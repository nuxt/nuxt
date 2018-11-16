import path from 'path'

let _nuxt

export default {
  render: {
    dist: {
      maxAge: ((60 * 60 * 24 * 365) * 2)
    }
  },
  router: {
    extendRoutes(routes, resolve) {
      return [{
        path: '/before-enter',
        name: 'before-enter',
        beforeEnter: (to, from, next) => { next('/') }
      }, ...routes]
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
      '/store-module',
      '/users/1',
      '/users/2',
      { route: '/users/3', payload: { id: 3000 } }
    ],
    interval: 200,
    subFolders: true
  },
  head() {
    return {
      titleTemplate: (titleChunk) => {
        return titleChunk ? `${titleChunk} - Nuxt.js` : 'Nuxt.js'
      }
    }
  },
  modulesDir: path.join(__dirname, '..', '..', '..', 'node_modules'),
  hooks: {
    ready(nuxt) {
      _nuxt = nuxt
      nuxt.__hook_ready_called__ = true
    },
    build: {
      done(builder) {
        builder.__hook_built_called__ = true
      }
    },
    render: {
      routeDone(url) {
        _nuxt.__hook_render_routeDone__ = url
      }
    },
    bad: null,
    '': true
  },
  transition: false,
  plugins: [
    '~/plugins/vuex-module',
    '~/plugins/dir-plugin',
    '~/plugins/inject'
  ],
  build: {
    scopeHoisting: true,
    postcss: {
      preset: {
        features: {
          'custom-selectors': true
        }
      },
      plugins: {
        cssnano: {},
        [path.resolve(__dirname, 'plugins', 'tailwind.js')]: {}
      }
    }
  }
}
