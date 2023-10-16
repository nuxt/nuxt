import type { Configuration } from 'webpack'
import type { Nuxt, NuxtOptions } from '@nuxt/schema'
import { logger } from '@nuxt/kit'
import { klona } from 'klona'

export interface WebpackConfigContext {
  nuxt: Nuxt
  options: NuxtOptions
  userConfig: Omit<NuxtOptions['webpack'], '$client' | '$server'>
  config: Configuration
  name: string
  isDev: boolean
  isServer: boolean
  isClient: boolean
  alias: { [index: string]: string | false | string[] }
  transpile: RegExp[]
}

type WebpackConfigPreset = (ctx: WebpackConfigContext, options?: object) => void
type WebpackConfigPresetItem = WebpackConfigPreset | [WebpackConfigPreset, any]

export function createWebpackConfigContext (nuxt: Nuxt): WebpackConfigContext {
  return {
    nuxt,
    options: nuxt.options,
    userConfig: nuxt.options.webpack,
    config: {},

    name: 'base',
    isDev: nuxt.options.dev,
    isServer: false,
    isClient: false,

    alias: {},
    transpile: []
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
  let fileName = ctx.userConfig.filenames[key]

  if (typeof fileName === 'function') {
    fileName = fileName(ctx)
  }

  if (typeof fileName === 'string' && ctx.options.dev) {
    const hash = /\[(chunkhash|contenthash|hash)(?::(\d+))?]/.exec(fileName)
    if (hash) {
      logger.warn(`Notice: Please do not use ${hash[1]} in dev mode to prevent memory leak`)
    }
  }

  return fileName
}

export function getWebpackConfig (ctx: WebpackConfigContext): Configuration {
  // Clone to avoid leaking config between Client and Server
  return klona(ctx.config)
}
