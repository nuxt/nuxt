import type { Configuration as WebpackConfig, WebpackPluginInstance } from 'webpack'
import type { RspackPluginInstance } from '@rspack/core'
import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import type { NastiConfig, NastiPlugin } from '@nasti-toolchain/nasti'
import { useNuxt } from './context.ts'
import { toArray } from './utils.ts'
import { resolveAlias } from './resolve.ts'
import { getUserCaller, warn } from './internal/trace.ts'

type Arrayable<T> = T | T[]
type Thenable<T> = T | Promise<T>

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

const extendWebpackCompatibleConfig = (builder: 'rspack' | 'webpack') => (fn: ((config: WebpackConfig) => Thenable<void>), options: ExtendWebpackConfigOptions = {}) => {
  const nuxt = useNuxt()

  if (options.dev === false && nuxt.options.dev) {
    return
  }
  if (options.build === false && nuxt.options.build) {
    return
  }

  nuxt.hook(`${builder}:config`, async (configs) => {
    if (options.server !== false) {
      const config = configs.find(i => i.name === 'server')
      if (config) {
        await fn(config)
      }
    }
    if (options.client !== false) {
      const config = configs.find(i => i.name === 'client')
      if (config) {
        await fn(config)
      }
    }
  })
}

type ExtendWebpacklikeConfig = (fn: (config: WebpackConfig) => void, options?: ExtendWebpackConfigOptions) => void

/**
 * Extend webpack config
 *
 * The fallback function might be called multiple times
 * when applying to both client and server builds.
 */
export const extendWebpackConfig: ExtendWebpacklikeConfig = extendWebpackCompatibleConfig('webpack')
/**
 * Extend rspack config
 *
 * The fallback function might be called multiple times
 * when applying to both client and server builds.
 */
export const extendRspackConfig: ExtendWebpacklikeConfig = extendWebpackCompatibleConfig('rspack')

/**
 * Extend Vite config
 */
export function extendViteConfig (fn: ((config: ViteConfig) => Thenable<void>), options: ExtendViteConfigOptions = {}): (() => void) | undefined {
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
    const warning = `[@nuxt/kit] calling \`extendViteConfig\` with only server/client environment is deprecated${explanation}. Nuxt 5+ will use the Vite Environment API which shares a configuration between environments. You can likely use a Vite plugin to achieve the same result.`
    warn(warning)
  }

  // Call fn() only once
  return nuxt.hook('vite:extend', ({ config }) => fn(config))
}

/**
 * Append webpack plugin to the config.
 */
export function addWebpackPlugin (pluginOrGetter: Arrayable<WebpackPluginInstance> | (() => Thenable<Arrayable<WebpackPluginInstance>>), options?: ExtendWebpackConfigOptions): void {
  extendWebpackConfig(async (config) => {
    const method: 'push' | 'unshift' = options?.prepend ? 'unshift' : 'push'
    const plugin = typeof pluginOrGetter === 'function' ? await pluginOrGetter() : pluginOrGetter

    config.plugins ||= []
    config.plugins[method](...toArray(plugin))
  }, options)
}
/**
 * Append rspack plugin to the config.
 */
export function addRspackPlugin (pluginOrGetter: Arrayable<RspackPluginInstance> | (() => Thenable<Arrayable<RspackPluginInstance>>), options?: ExtendWebpackConfigOptions): void {
  extendRspackConfig(async (config) => {
    const method: 'push' | 'unshift' = options?.prepend ? 'unshift' : 'push'
    const plugin = typeof pluginOrGetter === 'function' ? await pluginOrGetter() : pluginOrGetter

    config.plugins ||= []
    config.plugins[method](...toArray(plugin))
  }, options)
}

/**
 * Append Vite plugin to the config.
 */
export function addVitePlugin (pluginOrGetter: Arrayable<VitePlugin> | (() => Thenable<Arrayable<VitePlugin>>), options: ExtendConfigOptions = {}): void {
  const nuxt = useNuxt()

  if (options.dev === false && nuxt.options.dev) {
    return
  }
  if (options.build === false && nuxt.options.build) {
    return
  }

  let needsEnvInjection = false
  nuxt.hook('vite:extend', async ({ config }) => {
    config.plugins ||= []

    const plugin = toArray(typeof pluginOrGetter === 'function' ? await pluginOrGetter() : pluginOrGetter)
    if (options.server !== false && options.client !== false) {
      const method: 'push' | 'unshift' = options?.prepend ? 'unshift' : 'push'
      config.plugins[method](...plugin)
      return
    }

    if (!config.environments?.ssr || !config.environments.client) {
      needsEnvInjection = true
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

  nuxt.hook('vite:extendConfig', async (config, env) => {
    if (!needsEnvInjection) {
      return
    }
    const plugin = toArray(typeof pluginOrGetter === 'function' ? await pluginOrGetter() : pluginOrGetter)
    const method: 'push' | 'unshift' = options?.prepend ? 'unshift' : 'push'
    if (env.isClient && options.server === false) {
      config.plugins![method](...plugin)
    }
    if (env.isServer && options.client === false) {
      config.plugins![method](...plugin)
    }
  })
}

/**
 * Extend Nasti config
 *
 * Nasti (the Rolldown-based builder) shares a single config across its `client` and
 * `ssr` environments via the Environment API, so — unlike webpack/rspack — `fn` is
 * called once with the shared config rather than per named compiler.
 */
export function extendNastiConfig (fn: ((config: NastiConfig) => Thenable<void>), options: ExtendConfigOptions = {}): (() => void) | undefined {
  const nuxt = useNuxt()

  if (options.dev === false && nuxt.options.dev) {
    return
  }
  if (options.build === false && nuxt.options.build) {
    return
  }

  // Call fn() only once
  return nuxt.hook('nasti:extend', ({ config }) => fn(config))
}

/**
 * Append Nasti plugin to the config.
 */
export function addNastiPlugin (pluginOrGetter: Arrayable<NastiPlugin> | (() => Thenable<Arrayable<NastiPlugin>>), options: ExtendConfigOptions = {}): void {
  const nuxt = useNuxt()

  if (options.dev === false && nuxt.options.dev) {
    return
  }
  if (options.build === false && nuxt.options.build) {
    return
  }

  nuxt.hook('nasti:extend', async ({ config }) => {
    config.plugins ||= []

    const plugins = toArray(typeof pluginOrGetter === 'function' ? await pluginOrGetter() : pluginOrGetter)
    const method: 'push' | 'unshift' = options?.prepend ? 'unshift' : 'push'

    // Common case — apply to every environment.
    if (options.server !== false && options.client !== false) {
      config.plugins[method](...plugins)
      return
    }

    // Environment-scoped. Nasti's `applyToEnvironment` is a boolean *filter* (not the
    // plugin-returning form Vite uses), so we restrict each plugin to the requested
    // environment while preserving any `applyToEnvironment` the plugin already declared.
    const environmentName = options.server === false ? 'client' : 'ssr'
    for (const plugin of plugins) {
      const userApply = plugin.applyToEnvironment
      config.plugins[method]({
        ...plugin,
        applyToEnvironment (environment) {
          if (environment.name !== environmentName) {
            return false
          }
          return userApply ? userApply(environment) : true
        },
      })
    }
  })
}

interface AddBuildPluginFactory {
  vite?: () => Thenable<Arrayable<VitePlugin>>
  webpack?: () => Thenable<Arrayable<WebpackPluginInstance>>
  rspack?: () => Thenable<Arrayable<RspackPluginInstance>>
  nasti?: () => Thenable<Arrayable<NastiPlugin>>
}

export function addBuildPlugin (pluginFactory: AddBuildPluginFactory, options?: ExtendConfigOptions): void {
  if (pluginFactory.vite) {
    addVitePlugin(pluginFactory.vite, options)
  }

  if (pluginFactory.webpack) {
    addWebpackPlugin(pluginFactory.webpack, options)
  }

  if (pluginFactory.rspack) {
    addRspackPlugin(pluginFactory.rspack, options)
  }

  if (pluginFactory.nasti) {
    addNastiPlugin(pluginFactory.nasti, options)
  }
}
