import type { Configuration as WebpackConfig, WebpackPluginInstance } from 'webpack'
import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import { useNuxt } from './context'

export interface ExtendConfigOptions {
  /**
   * Install plugin on dev
   *
   * @default true
   */
  dev?: boolean
  /**
   * Install plugin on build
   *
   * @default true
   */
  build?: boolean
  /**
   * Install plugin on server side
   *
   * @default true
   */
  server?: boolean
  /**
   * Install plugin on client side
   *
   * @default true
   */
  client?: boolean
  /**
   * Prepends the plugin to the array with `unshit()` instead of `push()`.
   */
  prepend?: boolean
}

export interface ExtendWebpackConfigOptions extends ExtendConfigOptions {}

export interface ExtendViteConfigOptions extends ExtendConfigOptions {}

/**
 * Extend webpack config
 *
 * The fallback function might be called multiple times
 * when applying to both client and server builds.
 */
export function extendWebpackConfig (
  fn: ((config: WebpackConfig) => void),
  options: ExtendWebpackConfigOptions = {}
) {
  const nuxt = useNuxt()

  if (options.dev === false && nuxt.options.dev) {
    return
  }
  if (options.build === false && nuxt.options.build) {
    return
  }

  nuxt.hook('webpack:config', (configs: WebpackConfig[]) => {
    if (options.server !== false) {
      const config = configs.find(i => i.name === 'server')
      if (config) {
        fn(config)
      }
    }
    if (options.client !== false) {
      const config = configs.find(i => i.name === 'client')
      if (config) {
        fn(config)
      }
    }
  })
}

/**
 * Extend Vite config
 */
export function extendViteConfig (
  fn: ((config: ViteConfig) => void),
  options: ExtendViteConfigOptions = {}
) {
  const nuxt = useNuxt()

  if (options.dev === false && nuxt.options.dev) {
    return
  }
  if (options.build === false && nuxt.options.build) {
    return
  }

  if (options.server !== false && options.client !== false) {
    // Call fn() only once
    return nuxt.hook('vite:extend', ({ config }) => fn(config))
  }

  nuxt.hook('vite:extendConfig', (config, { isClient, isServer }) => {
    if (options.server !== false && isServer) {
      return fn(config)
    }
    if (options.client !== false && isClient) {
      return fn(config)
    }
  })
}

/**
 * Append webpack plugin to the config.
 */
export function addWebpackPlugin (pluginOrGetter: WebpackPluginInstance | WebpackPluginInstance[] | (() => WebpackPluginInstance | WebpackPluginInstance[]), options?: ExtendWebpackConfigOptions) {
  extendWebpackConfig((config) => {
    const method: 'push' | 'unshift' = options?.prepend ? 'unshift' : 'push'
    const plugin = typeof pluginOrGetter === 'function' ? pluginOrGetter() : pluginOrGetter

    config.plugins = config.plugins || []
    if (Array.isArray(plugin)) {
      config.plugins[method](...plugin)
    } else {
      config.plugins[method](plugin)
    }
  }, options)
}

/**
 * Append Vite plugin to the config.
 */
export function addVitePlugin (pluginOrGetter: VitePlugin | VitePlugin[] | (() => VitePlugin | VitePlugin[]), options?: ExtendViteConfigOptions) {
  extendViteConfig((config) => {
    const method: 'push' | 'unshift' = options?.prepend ? 'unshift' : 'push'
    const plugin = typeof pluginOrGetter === 'function' ? pluginOrGetter() : pluginOrGetter

    config.plugins = config.plugins || []
    if (Array.isArray(plugin)) {
      config.plugins[method](...plugin)
    } else {
      config.plugins[method](plugin)
    }
  }, options)
}

interface AddBuildPluginFactory {
  vite?: () => VitePlugin | VitePlugin[]
  webpack?: () => WebpackPluginInstance | WebpackPluginInstance[]
}

export function addBuildPlugin (pluginFactory: AddBuildPluginFactory, options?: ExtendConfigOptions) {
  if (pluginFactory.vite) {
    addVitePlugin(pluginFactory.vite, options)
  }

  if (pluginFactory.webpack) {
    addWebpackPlugin(pluginFactory.webpack, options)
  }
}
