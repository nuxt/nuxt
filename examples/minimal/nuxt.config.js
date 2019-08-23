export default {
  loading: false,
  loadingIndicator: false,
  fetch: {
    client: false,
    server: false
  },
  features: {
    middleware: false,
    transitions: false,
    meta: false,
    router: true,
    store: true,
    deprecations: false,
    client: {
      validate: false,
      asyncData: false,
      fetch: false,
      online: false,
      prefetch: false,
      useUrl: true
    },
    components: {
      aliases: false,
      clientOnly: false,
      noSsr: false
    }
  },
  build: {
    indicator: false,
    terser: true,
    cache: false,
    hardSource: false,
    parallel: false
  }
}
