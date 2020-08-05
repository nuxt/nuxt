export default () => ({
  vue: {
    config: {
      silent: undefined, // = !dev
      performance: undefined // = dev
    }
  },

  vueMeta: null,

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

  extendPlugins: null,

  css: [],

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
    store: true,
    layouts: true,
    meta: true,
    middleware: true,
    transitions: true,
    deprecations: true,
    validate: true,
    asyncData: true,
    fetch: true,
    clientOnline: true,
    clientPrefetch: true,
    clientUseUrl: false,
    componentAliases: true,
    componentClientOnly: true
  }
})
