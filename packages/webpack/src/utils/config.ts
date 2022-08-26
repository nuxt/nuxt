import { cloneDeep } from 'lodash-es'
import type { Configuration } from 'webpack'
import type { Nuxt } from '@nuxt/schema'
import { logger } from '@nuxt/kit'

export interface WebpackConfigContext extends ReturnType<typeof createWebpackConfigContext>{ }

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

  let fileName = options.webpack.filenames[key as keyof typeof options.webpack.filenames] as ((ctx: WebpackConfigContext) => string) | string

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
  const { options, config } = ctx

  // TODO
  const builder = {}
  const loaders: any[] = []

  // @ts-ignore
  const { extend } = options.build
  if (typeof extend === 'function') {
    const extendedConfig = extend.call(
      builder,
      config,
      { loaders, ...ctx }
    ) || config

    const pragma = /@|#/
    const { devtool } = extendedConfig
    if (typeof devtool === 'string' && pragma.test(devtool)) {
      extendedConfig.devtool = devtool.replace(pragma, '')
      logger.warn(`devtool has been normalized to ${extendedConfig.devtool} as webpack documented value`)
    }

    return extendedConfig
  }

  // Clone deep avoid leaking config between Client and Server
  return cloneDeep(config)
}
