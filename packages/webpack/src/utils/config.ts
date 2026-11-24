import type { Configuration } from 'webpack'
import type { Nuxt, NuxtOptions } from '@nuxt/schema'
import { configDiagnostics } from '@nuxt/kit/internal'

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

type WebpackConfigPreset = (ctx: WebpackConfigContext) => void | Promise<void>

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
    transpile: [],
  }
}

export async function applyPresets (ctx: WebpackConfigContext, presets: WebpackConfigPreset[]) {
  for (const preset of presets) {
    await preset(ctx)
  }
}

export function fileName (ctx: WebpackConfigContext, key: string) {
  let fileName = ctx.userConfig.filenames[key]

  if (typeof fileName === 'function') {
    fileName = fileName(ctx)
  }

  if (typeof fileName === 'string' && ctx.options.dev) {
    const hash = /\[(chunkhash|contenthash|hash)(?::\d+)?\]/.exec(fileName)
    if (hash) {
      configDiagnostics.NUXT_B5006({ option: hash[1]! })
    }
  }

  return fileName
}
