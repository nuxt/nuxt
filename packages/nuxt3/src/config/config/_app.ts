import type { App } from 'vue'
import type { MetaInfo, VueMetaOptions } from 'vue-meta'

type Plugin = string | { mode?: 'all' | 'client' | 'server', src: string, ssr?: boolean }

interface AppOptions {
  css: string[]
  head: MetaInfo
  ErrorPage: null | string
  extendPlugins: null | ((plugins: Plugin[]) => Plugin[])
  features: {
    store: boolean
    layouts: boolean
    meta: boolean
    middleware: boolean
    transitions: boolean
    deprecations: boolean
    validate: boolean
    asyncData: boolean
    fetch: boolean
    clientOnline: boolean
    clientPrefetch: boolean
    clientUseUrl: boolean
    componentAliases: boolean
    componentClientOnly: boolean
  }
  fetch: {
    server: boolean
    client: boolean
  }
  layouts: {}
  layoutTransition: {
    name: string
    mode?: string | 'out-in'
  }
  loading: string | false | {
    color?: string
    continuous?: boolean
    css?: boolean
    duration?: number
    failedColor?: string
    height?: string
    rtl?: boolean
    throttle?: number
  }
  loadingIndicator: string | false | {
    background?: string
    color?: string
    color2?: string
    name?: string
  }
  pageTransition: {
    name: string
    mode?: string | 'out-in'
    appear?: boolean
    appearClass?: string
    appearActiveClass?: string
    appearToClass?: string
  }
  plugins: Array<Plugin>
  vue: {
    config: Partial<App['config']>
  }
  vueMeta: null | VueMetaOptions
}

export default (): AppOptions => ({
  vue: {
    config: {
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

// type NormalizedConfiguration<T extends Record<string, any>> = T & {
//   pageTransition?: Exclude<T['pageTransition'], string>
//   layoutTransition?: Exclude<T['layoutTransition'], string>
//   extensions?: Exclude<T['extensions'], string>
// }

// export function normalizeAppConfig<O extends Configuration>(options: O): asserts options is NormalizedConfiguration<O> {
//   (options as NormalizedConfiguration<O>).__normalized__ = true

//   // Normalize options
//   if (options.loading === true) {
//     delete options.loading
//   }

//   if (options.router && typeof options.router.base === 'string') {
//     (options as NormalizedConfiguration<O>)._routerBaseSpecified = true
//   }

//   if (typeof options.pageTransition === 'string') {
//     options.pageTransition = { name: options.pageTransition }
//   }

//   if (typeof options.layoutTransition === 'string') {
//     options.layoutTransition = { name: options.layoutTransition }
//   }

//   if (typeof options.extensions === 'string') {
//     options.extensions = [options.extensions]
//   }
// }