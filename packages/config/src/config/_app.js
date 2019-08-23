export default () => ({
  vue: {
    config: {
      silent: undefined, // = !dev
      performance: undefined // = dev
    }
  },

  head: {
    meta: [],
    link: [],
    style: [],
    script: []
  },

  fetch: {
    server: true,
    client: true
  },

  plugins: [],

  css: [],

  modules: [],
  buildModules: [],

  layouts: {},

  ErrorPage: null,

  loading: {
    color: 'black',
    failedColor: 'red',
    height: '2px',
    throttle: 200,
    duration: 5000,
    continuous: false,
    rtl: false,
    css: true
  },

  loadingIndicator: 'default',

  pageTransition: {
    name: 'page',
    mode: 'out-in',
    appear: false,
    appearClass: 'appear',
    appearActiveClass: 'appear-active',
    appearToClass: 'appear-to'
  },

  layoutTransition: {
    name: 'layout',
    mode: 'out-in'
  },

  features: {
    router: true, // not implemented
    store: true, // not implemented
    layouts: true, // not implemented
    meta: true,
    middleware: true,
    transitions: true,
    deprecations: true,
    validate: true,
    asyncData: true,
    fetch: true,
    client: {
      online: true,
      prefetch: true,
      useUrl: false
    },
    components: {
      aliases: true,
      clientOnly: true,
      noSsr: true
    }
  }
})
