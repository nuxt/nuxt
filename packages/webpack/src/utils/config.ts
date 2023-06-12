import { cloneDeep } from 'lodash-es'
import type { Configuration } from 'webpack'
import type { Nuxt } from '@nuxt/schema'
import { logger } from '@nuxt/kit'

export interface WebpackConfigContext extends ReturnType<typeof createWebpackConfigContext> {}

type WebpackConfigPreset = (ctx: WebpackConfigContext, options?: object) => void
type WebpackConfigPresetItem = WebpackConfigPreset | [WebpackConfigPreset, any]

export function createWebpackConfigContext (nuxt: Nuxt) {
  return {
    nuxt,
    options: nuxt.options,
    config: {} as Configuration,

    name: 'base',
    isDev: nuxt.options.dev,
    isServer: false,
    isClient: false,

    alias: {} as { [index: string]: string | false | string[] },
    transpile: [] as RegExp[]
  }
}

export function applyPresets (ctx: WebpackConfigContext, presets: WebpackConfigPresetItem | WebpackConfigPresetItem[]) {
  if (!Array.isArray(presets)) {
    presets = [presets]
  }
  for (const preset of presets) {
    if (Array.isArray(preset)) {
      preset[0](ctx, preset[1])
    } else {
      preset(ctx)
    }
  }
}

export function fileName (ctx: WebpackConfigContext, key: string) {
  const { options } = ctx

  let fileName = options.webpack.filenames[key]

  if (typeof fileName === 'function') {
    fileName = fileName(ctx)
  }

  if (typeof fileName === 'string' && options.dev) {
    const hash = /\[(chunkhash|contenthash|hash)(?::(\d+))?]/.exec(fileName)
    if (hash) {
      logger.warn(`Notice: Please do not use ${hash[1]} in dev mode to prevent memory leak`)
    }
  }

  return fileName
}

export function getWebpackConfig (ctx: WebpackConfigContext): Configuration {
  // @ts-expect-error TODO: remove support for `build.extend` in v3.6
  const { extend } = ctx.options.build
  if (typeof extend === 'function') {
    logger.warn('[nuxt] The `build.extend` and `webpack.build.extend` properties have been deprecated in Nuxt 3 for some time and will be removed in a future minor release. Instead, you can extend webpack config using the `webpack:config` hook.')

    const extendedConfig = extend.call(
      {},
      ctx.config,
      { loaders: [], ...ctx }
    ) || ctx.config

    const pragma = /@|#/
    const { devtool } = extendedConfig
    if (typeof devtool === 'string' && pragma.test(devtool)) {
      extendedConfig.devtool = devtool.replace(pragma, '')
      logger.warn(`devtool has been normalized to ${extendedConfig.devtool} as webpack documented value`)
    }

    return extendedConfig
  }

  // Clone deep avoid leaking config between Client and Server
  return cloneDeep(ctx.config)
}
