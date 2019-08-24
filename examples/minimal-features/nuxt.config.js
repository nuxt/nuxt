export default {
  loading: false,
  loadingIndicator: false,
  fetch: {
    client: false,
    server: false
  },
  features: {
    store: false,
    layouts: false,
    meta: false,
    middleware: false,
    transitions: false,
    deprecations: false,
    validate: false,
    asyncData: false,
    fetch: false,
    client: {
      online: false,
      prefetch: false,
      useUrl: true
    },
    components: {
      aliases: false,
      clientOnly: false
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
