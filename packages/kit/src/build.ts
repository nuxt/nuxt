import type { Configuration as WebpackConfig, WebpackPluginInstance } from 'webpack'
import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'
import type { Nuxt, NuxtBuildOutputs } from '@nuxt/schema'
import { useNuxt } from './context.ts'
import { toArray } from './utils.ts'
import { resolveAlias } from './resolve.ts'
import { getUserCaller, warn } from './internal/trace.ts'

type Arrayable<T> = T | T[]
type Thenable<T> = T | Promise<T>
type RspackCompatiblePluginInstance = {
  apply: (...args: any[]) => void
  [k: string]: any
}

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
export function addRspackPlugin (pluginOrGetter: Arrayable<RspackCompatiblePluginInstance> | (() => Thenable<Arrayable<RspackCompatiblePluginInstance>>), options?: ExtendWebpackConfigOptions): void {
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
  const isIsomorphic = options.server !== false && options.client !== false

  nuxt.hook('vite:extend', async ({ config }) => {
    config.plugins ||= []

    const plugin = toArray(typeof pluginOrGetter === 'function' ? await pluginOrGetter() : pluginOrGetter)
    if (isIsomorphic && !nuxt.options.experimental.nitroViteEnvironment) {
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
      // isomorphic plugins are normally just added to plugins, so only force when `prepend` is set
      enforce: isIsomorphic ? (options?.prepend ? 'pre' : undefined) : (options?.prepend ? 'pre' : 'post'),
      applyToEnvironment (environment) {
        if (isIsomorphic ? environment.name === 'client' || environment.name === 'ssr' : environment.name === environmentName) {
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

interface AddBuildPluginFactory {
  vite?: () => Thenable<Arrayable<VitePlugin>>
  webpack?: () => Thenable<Arrayable<WebpackPluginInstance>>
  rspack?: () => Thenable<Arrayable<RspackCompatiblePluginInstance>>
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
}

/**
 * Set the build output for the given key. See {@link NuxtBuildOutputs}.
 */
export function setBuildOutput<K extends keyof NuxtBuildOutputs> (key: K, provider: NuxtBuildOutputs[K], nuxt: Nuxt = useNuxt()): void {
  nuxt.buildOutputs[key] = provider
}
