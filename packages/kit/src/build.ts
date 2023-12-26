import type { Configuration as WebpackConfig, WebpackPluginInstance } from 'webpack'
import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
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
 * Extends the webpack configuration. Callback function can be called multiple times, when applying to both client and server builds.
 * @param callbackFunction - A callback function that will be called with the webpack configuration object.
 * @param options - Options to pass to the callback function. See {@link https://nuxt.com/docs/api/kit/builder#options available options}.
 * @see {@link https://nuxt.com/docs/api/kit/builder#extendwebpackconfig documentation}
 */
export function extendWebpackConfig (
  callbackFunction: ((config: WebpackConfig) => void),
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
      const config = configs.find((config) => config.name === 'server')

      if (config) {
        callbackFunction(config)
      }
    } else if (options.client !== false) {
      const config = configs.find((config) => config.name === 'client')

      if (config) {
        callbackFunction(config)
      }
    }
  })
}

/**
 * Extends the Vite configuration. Callback function can be called multiple times, when applying to both client and server builds.
 * @param callbackFunction - A callback function that will be called with the Vite configuration object.
 * @param options - Options to pass to the callback function. See {@link https://nuxt.com/docs/api/kit/builder#options-1 available options}.
 * @see {@link https://nuxt.com/docs/api/kit/builder#extendviteconfig documentation}
 */
export function extendViteConfig (
  callbackFunction: ((config: ViteConfig) => void),
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
    // Call callbackFunction() only once
    nuxt.hook('vite:extend', ({ config }) => callbackFunction(config))

    return
  }

  nuxt.hook('vite:extendConfig', (config, { isClient, isServer }) => {
    if (options.server !== false && isServer) {
      return callbackFunction(config)
    }

    if (options.client !== false && isClient) {
      return callbackFunction(config)
    }
  })
}

/**
 * Append webpack plugin to the config.
 * @param pluginOrGetter - A webpack plugin instance or an array of webpack plugin instances. If a function is provided, it must return a webpack plugin instance or an array of webpack plugin instances.
 * @param options - Options to pass to the callback function. See {@link https://nuxt.com/docs/api/kit/builder#options-2 available options}.
 * @see {@link https://nuxt.com/docs/api/kit/builder#addwebpackplugin documentation}
 */
export function addWebpackPlugin (
  pluginOrGetter:
  | WebpackPluginInstance
  | WebpackPluginInstance[]
  | (() => WebpackPluginInstance | WebpackPluginInstance[]),
  options?: ExtendWebpackConfigOptions
) {
  extendWebpackConfig((config) => {
    const method: 'push' | 'unshift' = options?.prepend ? 'unshift' : 'push'

    const plugin = typeof pluginOrGetter === 'function'
      ? pluginOrGetter()
      : pluginOrGetter

    config.plugins = config.plugins || []
    config.plugins[method](...toArray(plugin))
  }, options)
}

/**
 * Append Vite plugin to the config.
 * @param pluginOrGetter - A Vite plugin instance or an array of Vite plugin instances. If a function is provided, it must return a Vite plugin instance or an array of Vite plugin instances.
 * @param options - Options to pass to the callback function. See {@link https://nuxt.com/docs/api/kit/builder#options-3 available options}.
 * @see {@link https://nuxt.com/docs/api/kit/builder#addviteplugin documentation}
 */
export function addVitePlugin (
  pluginOrGetter:
  | VitePlugin
  | VitePlugin[]
  | (() => VitePlugin | VitePlugin[]),
  options?: ExtendViteConfigOptions
) {
  extendViteConfig((config) => {
    const method: 'push' | 'unshift' = options?.prepend ? 'unshift' : 'push'

    const plugin = typeof pluginOrGetter === 'function'
      ? pluginOrGetter()
      : pluginOrGetter

    config.plugins = config.plugins || []
    config.plugins[method](...toArray(plugin))
  }, options)
}

interface AddBuildPluginFactory {
  vite?: () => VitePlugin | VitePlugin[]
  webpack?: () => WebpackPluginInstance | WebpackPluginInstance[]
}

/**
 * Builder-agnostic version of `addWebpackPlugin` and `addVitePlugin`. It will add the plugin to both webpack and Vite configurations if they are present.
 * @param pluginFactory - A factory function that returns an object with `vite` and/or `webpack` properties. These properties must be functions that return a Vite plugin instance or an array of Vite plugin instances and/or a webpack plugin instance or an array of webpack plugin instances.
 * @param options - Options to pass to the callback function. See {@link https://nuxt.com/docs/api/kit/builder#options-4 available options}.
 * @see {@link https://nuxt.com/docs/api/kit/builder#addbuildplugin documentation}
 */
export function addBuildPlugin (
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
