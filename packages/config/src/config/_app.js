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

  plugins: [],

  css: [],

  modules: [],

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

  transition: {
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
  }
})
