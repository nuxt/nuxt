export default {
  target: 'static',
  router: {
    // base: '/test',
  },
  build: {
    publicPath: 'https://cdn.nuxtjs.org/test/_nuxt/'
  },
  foo: {
    shell: process.env.SHELL
  },
  env: {
    x: 123
  },
  hooks: {
    generate: {
      before ({ setPayload }) {
        setPayload({ shared: true })
      },
      route ({ route, setPayload }) {
        setPayload({ myRoute: route })
      }
    }
  }
}
