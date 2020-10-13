export default {
  target: 'static',
  export: {
    payload: {
      config: true
    }
  },
  router: {
    // base: '/test',
  },
  build: {
    publicPath: '/test/_nuxt/'
  },
  foo: {
    shell: process.env.SHELL
  },
  env: {
    x: 123
  },
  hooks: {
    export: {
      before ({ setPayload }) {
        setPayload({ shared: true })
      },
      route ({ route, setPayload }) {
        setPayload({ myRoute: route })
      }
    }
  }
}
