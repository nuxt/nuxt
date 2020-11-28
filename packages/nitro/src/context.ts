import { resolve } from 'upath'
import defu from 'defu'
import type { NuxtOptions } from '@nuxt/types'
import Hookable, { configHooksT } from 'hookable'
import type { Preset } from '@nuxt/un'
import { tryImport, resolvePath, detectTarget, extendPreset } from './utils'
import * as PRESETS from './presets'

export interface ServerMiddleware {
  route: string
  handle: string
  lazy?: boolean // Default is true
  promisify?: boolean // Default is true
}

export interface SigmaContext {
  timing: boolean
  inlineChunks: boolean
  minify: boolean
  externals: boolean
  analyze: boolean
  entry: string
  node: boolean
  preset: string
  rollupConfig?: any
  renderer: string
  serveStatic: boolean
  middleware: ServerMiddleware[]
  hooks: configHooksT
  nuxtHooks: configHooksT
  ignore: string[]
  env: Preset
  output: {
    dir: string
    serverDir: string
    publicDir: string
  }
  _nuxt: {
    dev: boolean
    rootDir: string
    srcDir: string
    buildDir: string
    generateDir: string
    staticDir: string
    routerBase: string
    publicPath: string
    isStatic: boolean
    fullStatic: boolean
    staticAssets: any
    runtimeConfig: { public: any, private: any }
  }
  _internal: {
    runtimeDir: string
    hooks: Hookable
  }
}

type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> }

export interface SigmaInput extends DeepPartial<SigmaContext> {}

export type SigmaPreset = SigmaInput | ((input: SigmaInput) => SigmaInput)

export function getsigmaContext (nuxtOptions: NuxtOptions, input: SigmaInput): SigmaContext {
  const defaults: SigmaContext = {
    timing: true,
    inlineChunks: true,
    minify: true,
    externals: false,
    analyze: false,
    entry: undefined,
    node: undefined,
    preset: undefined,
    rollupConfig: undefined,
    renderer: undefined,
    serveStatic: false,
    middleware: [],
    ignore: [],
    env: {},
    hooks: {},
    nuxtHooks: {},
    output: {
      dir: '{{ _nuxt.rootDir }}/.output',
      serverDir: '{{ output.dir }}/server',
      publicDir: '{{ output.dir }}/public'
    },
    _nuxt: {
      dev: nuxtOptions.dev,
      rootDir: nuxtOptions.rootDir,
      srcDir: nuxtOptions.srcDir,
      buildDir: nuxtOptions.buildDir,
      generateDir: nuxtOptions.generate.dir,
      staticDir: nuxtOptions.dir.static,
      routerBase: nuxtOptions.router.base,
      publicPath: nuxtOptions.build.publicPath,
      isStatic: nuxtOptions.target === 'static' && !nuxtOptions.dev,
      fullStatic: nuxtOptions.target === 'static' && !nuxtOptions._legacyGenerate,
      // @ts-ignore
      staticAssets: nuxtOptions.generate.staticAssets,
      runtimeConfig: {
        public: nuxtOptions.publicRuntimeConfig,
        private: nuxtOptions.privateRuntimeConfig
      }
    },
    _internal: {
      runtimeDir: resolve(__dirname, '../runtime'),
      hooks: new Hookable()
    }
  }

  defaults.preset = input.preset || process.env.SIGMA_PRESET || detectTarget() || 'server'
  let presetDefaults = PRESETS[defaults.preset] || tryImport(nuxtOptions.rootDir, defaults.preset)
  if (!presetDefaults) {
    throw new Error('Cannot resolve preset: ' + defaults.preset)
  }
  presetDefaults = presetDefaults.default || presetDefaults

  const _presetInput = defu(input, defaults)
  // @ts-ignore
  const _preset = extendPreset(input, presetDefaults)(_presetInput)
  const sigmaContext: SigmaContext = defu(input, _preset, defaults) as any

  sigmaContext.output.dir = resolvePath(sigmaContext, sigmaContext.output.dir)
  sigmaContext.output.publicDir = resolvePath(sigmaContext, sigmaContext.output.publicDir)
  sigmaContext.output.serverDir = resolvePath(sigmaContext, sigmaContext.output.serverDir)

  sigmaContext._internal.hooks.addHooks(sigmaContext.hooks)

  // console.log(sigmaContext)
  // process.exit(1)

  return sigmaContext
}
