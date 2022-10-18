import type { WebpackPluginInstance, Configuration as WebpackConfig } from 'webpack'
import type { Plugin as VitePlugin, UserConfig as ViteConfig } from 'vite'
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
}

export interface ExtendWebpackConfigOptions extends ExtendConfigOptions {
  /**
   * Install plugin on modern build
   *
   * @default true
   * @deprecated Nuxt 2 only
   */
  modern?: boolean
}

export interface ExtendViteConfigOptions extends ExtendConfigOptions {}

/**
 * Extend Webpack config
 *
 * The fallback function might be called multiple times
 * when applying to both client and server builds.
 */
export function extendWebpackConfig (
  fn: ((config: WebpackConfig)=> void),
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
    // Nuxt 2 backwards compatibility
    if (options.modern !== false) {
      const config = configs.find(i => i.name === 'modern')
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
 * Append Webpack plugin to the config.
 */
export function addWebpackPlugin (plugin: WebpackPluginInstance | WebpackPluginInstance[], options?: ExtendWebpackConfigOptions) {
  extendWebpackConfig((config) => {
    config.plugins = config.plugins || []
    if (Array.isArray(plugin)) {
      config.plugins.push(...plugin)
    } else {
      config.plugins.push(plugin)
    }
  }, options)
}

/**
 * Append Vite plugin to the config.
 */
export function addVitePlugin (plugin: VitePlugin | VitePlugin[], options?: ExtendViteConfigOptions) {
  extendViteConfig((config) => {
    config.plugins = config.plugins || []
    if (Array.isArray(plugin)) {
      config.plugins.push(...plugin)
    } else {
      config.plugins.push(plugin)
    }
  }, options)
}
