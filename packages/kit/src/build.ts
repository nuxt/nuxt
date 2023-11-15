import { type Configuration as WebpackConfig, type WebpackPluginInstance } from 'webpack'
import { type UserConfig as ViteConfig, type Plugin as VitePlugin } from 'vite'
import { useNuxt } from './context'
import { toArray } from './utils'

export interface ExtendConfigOptions {
  /**
     * Install plugin on dev
     * @default true
     */
  dev?: boolean

  /**
     * Install plugin on build
     * @default true
     */
  build?: boolean

  /**
     * Install plugin on server side
     * @default true
     */
  server?: boolean

  /**
     * Install plugin on client side
     * @default true
     */
  client?: boolean

  /**
     * Prepends the plugin to the array with `unshift()` instead of `push()`.
     */
  prepend?: boolean
}

export interface ExtendWebpackConfigOptions extends ExtendConfigOptions { }

export interface ExtendViteConfigOptions extends ExtendConfigOptions { }

/**
 * Extend webpack config
 *
 * The callback function might be called multiple times
 * when applying to both client and server builds.
 */
export function extendWebpackConfig(
  callbackFunction: ((config: WebpackConfig) => void),
  options: ExtendWebpackConfigOptions = {}
) {
  const nuxt = useNuxt()

  if (
    (options.dev === false && nuxt.options.dev)
    || (options.build === false && !nuxt.options.dev)
  ) {
    return
  }

  nuxt.hook('webpack:config', (configs: WebpackConfig[]) => {
    if (options.server !== false) {
      const config = configs.find((index) => index.name === 'server')

      if (config) {
        callbackFunction(config)
      }
    } else if (options.client !== false) {
      const config = configs.find((index) => index.name === 'client')

      if (config) {
        callbackFunction(config)
      }
    }
  })
}

/**
 * Extend Vite config
 */
export function extendViteConfig(
  callbackFunction: ((config: ViteConfig) => void),
  options: ExtendViteConfigOptions = {}
) {
  const nuxt = useNuxt()

  if (
    (options.dev === false && nuxt.options.dev)
    || (options.build === false && !nuxt.options.dev)
  ) {
    return
  }

  if (options.server !== false && options.client !== false) {
    // Call callbackFunction() only once
    return nuxt.hook('vite:extend', ({ config }) => {
      callbackFunction(config)
    })
  }

  nuxt.hook('vite:extendConfig', (config, { isClient, isServer }) => {
    if (
      (options.server !== false && isServer)
      || (options.client !== false && isClient)
    ) {
      callbackFunction(config)
    }
  })
}

/**
 * Append webpack plugin to the config.
 */
export function addWebpackPlugin(
  pluginOrGetter:
  | WebpackPluginInstance
  | WebpackPluginInstance[]
  | (() => WebpackPluginInstance | WebpackPluginInstance[]),
  options?: ExtendWebpackConfigOptions
) {
  extendWebpackConfig((config) => {
    const method: 'push' | 'unshift' = options?.prepend ? 'unshift' : 'push'

    // eslint-disable-next-line ts/no-unsafe-assignment
    const plugins = toArray(
      typeof pluginOrGetter === 'function' ? pluginOrGetter() : pluginOrGetter
    )

    config.plugins = config.plugins || []

    // eslint-disable-next-line ts/no-unsafe-argument
    config.plugins[method](...plugins)
  }, options)
}

/**
 * Append Vite plugin to the config.
 */
export function addVitePlugin(
  pluginOrGetter:
  | VitePlugin
  | VitePlugin[]
  | (() => VitePlugin | VitePlugin[]),
  options?: ExtendViteConfigOptions
) {
  extendViteConfig((config) => {
    const method: 'push' | 'unshift' = options?.prepend ? 'unshift' : 'push'

    const plugins = toArray(
      typeof pluginOrGetter === 'function' ? pluginOrGetter() : pluginOrGetter
    )

    config.plugins = config.plugins || []

    config.plugins[method](...plugins)
  }, options)
}

interface AddBuildPluginFactory {
  vite?: () => VitePlugin | VitePlugin[]
  webpack?: () => WebpackPluginInstance | WebpackPluginInstance[]
}

export function addBuildPlugin(
  pluginFactory: AddBuildPluginFactory,
  options?: ExtendConfigOptions
) {
  if (pluginFactory.vite) {
    addVitePlugin(pluginFactory.vite, options)
  }

  if (pluginFactory.webpack) {
    addWebpackPlugin(pluginFactory.webpack, options)
  }
}
