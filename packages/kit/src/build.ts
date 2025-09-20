import type { Configuration as WebpackConfig, WebpackPluginInstance } from 'webpack'
import type { RspackPluginInstance } from '@rspack/core'
import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import { useNuxt } from './context'
import { toArray } from './utils'
import { resolveAlias } from './resolve'
import { getUserCaller, warn } from './internal/trace'

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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ExtendWebpackConfigOptions extends ExtendConfigOptions {}

export interface ExtendViteConfigOptions extends Omit<ExtendConfigOptions, 'server' | 'client'> {
  /**
   * Extend server Vite configuration
   * @default true
   * @deprecated calling \`extendViteConfig\` with only server/client environment is deprecated.
   * Nuxt 5+ uses the Vite Environment API which shares a configuration between environments.
   * You can likely use a Vite plugin to achieve the same result.
   */
  server?: boolean
  /**
   * Extend client Vite configuration
   * @default true
   * @deprecated calling \`extendViteConfig\` with only server/client environment is deprecated.
   * Nuxt 5+ uses the Vite Environment API which shares a configuration between environments.
   * You can likely use a Vite plugin to achieve the same result.
   */
  client?: boolean
}

const extendWebpackCompatibleConfig = (builder: 'rspack' | 'webpack') => (fn: ((config: WebpackConfig) => void), options: ExtendWebpackConfigOptions = {}) => {
  const nuxt = useNuxt()

  if (options.dev === false && nuxt.options.dev) {
    return
  }
  if (options.build === false && nuxt.options.build) {
    return
  }

  nuxt.hook(`${builder}:config`, (configs) => {
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
 * Extend webpack config
 *
 * The fallback function might be called multiple times
 * when applying to both client and server builds.
 */
export const extendWebpackConfig = extendWebpackCompatibleConfig('webpack')
/**
 * Extend rspack config
 *
 * The fallback function might be called multiple times
 * when applying to both client and server builds.
 */
export const extendRspackConfig = extendWebpackCompatibleConfig('rspack')

/**
 * Extend Vite config
 */
export function extendViteConfig (fn: ((config: ViteConfig) => void), options: ExtendViteConfigOptions = {}) {
  const nuxt = useNuxt()

  if (options.dev === false && nuxt.options.dev) {
    return
  }
  if (options.build === false && nuxt.options.build) {
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  if (options.server === false || options.client === false) {
    const caller = getUserCaller()
    const explanation = caller ? ` (used at \`${resolveAlias(caller.source)}:${caller.line}:${caller.column}\`)` : ''
    const warning = `[@nuxt/kit] calling \`extendViteConfig\` with only server/client environment is deprecated${explanation}. Nuxt 5+ uses the Vite Environment API which shares a configuration between environments. You can likely use a Vite plugin to achieve the same result.`
    warn(warning)
  }

  // Call fn() only once
  return nuxt.hook('vite:extend', ({ config }) => fn(config))
}

/**
 * Append webpack plugin to the config.
 */
export function addWebpackPlugin (pluginOrGetter: WebpackPluginInstance | WebpackPluginInstance[] | (() => WebpackPluginInstance | WebpackPluginInstance[]), options?: ExtendWebpackConfigOptions) {
  extendWebpackConfig((config) => {
    const method: 'push' | 'unshift' = options?.prepend ? 'unshift' : 'push'
    const plugin = typeof pluginOrGetter === 'function' ? pluginOrGetter() : pluginOrGetter

    config.plugins ||= []
    config.plugins[method](...toArray(plugin))
  }, options)
}
/**
 * Append rspack plugin to the config.
 */
export function addRspackPlugin (pluginOrGetter: RspackPluginInstance | RspackPluginInstance[] | (() => RspackPluginInstance | RspackPluginInstance[]), options?: ExtendWebpackConfigOptions) {
  extendRspackConfig((config) => {
    const method: 'push' | 'unshift' = options?.prepend ? 'unshift' : 'push'
    const plugin = typeof pluginOrGetter === 'function' ? pluginOrGetter() : pluginOrGetter

    config.plugins ||= []
    config.plugins[method](...toArray(plugin))
  }, options)
}

/**
 * Append Vite plugin to the config.
 */
export function addVitePlugin (pluginOrGetter: VitePlugin | VitePlugin[] | (() => VitePlugin | VitePlugin[]), options: ExtendConfigOptions = {}) {
  const nuxt = useNuxt()

  if (options.dev === false && nuxt.options.dev) {
    return
  }
  if (options.build === false && nuxt.options.build) {
    return
  }

  nuxt.hook('vite:extend', ({ config }) => {
    config.plugins ||= []

    const plugin = toArray(typeof pluginOrGetter === 'function' ? pluginOrGetter() : pluginOrGetter)

    if (options.server !== false && options.client !== false) {
      const method: 'push' | 'unshift' = options?.prepend ? 'unshift' : 'push'
      // Call fn() only once
      config.plugins[method](...plugin)
      return
    }

    const environmentName = options.server === false ? 'client' : 'ssr'
    const pluginName = plugin.map(p => p.name).join('|')
    config.plugins.push({
      name: `${pluginName}:wrapper`,
      enforce: options?.prepend ? 'pre' : 'post',
      applyToEnvironment (environment) {
        if (environment.name === environmentName) {
          return plugin
        }
      },
    })
  })
}

interface AddBuildPluginFactory {
  vite?: () => VitePlugin | VitePlugin[]
  webpack?: () => WebpackPluginInstance | WebpackPluginInstance[]
  rspack?: () => RspackPluginInstance | RspackPluginInstance[]
}

export function addBuildPlugin (pluginFactory: AddBuildPluginFactory, options?: ExtendConfigOptions) {
  if (pluginFactory.vite) {
    addVitePlugin(pluginFactory.vite, options)
  }

  if (pluginFactory.webpack) {
    addWebpackPlugin(pluginFactory.webpack, options)
  }

  if (pluginFactory.rspack) {
    addRspackPlugin(pluginFactory.rspack, options)
  }
}
