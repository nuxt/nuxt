import { resolve, dirname } from 'upath'
import defu from 'defu'
import type { NuxtOptions } from '@nuxt/kit'
import Hookable, { configHooksT } from 'hookable'
import type { Preset } from '@nuxt/un'
import { tryImport, resolvePath, detectTarget, extendPreset } from './utils'
import * as PRESETS from './presets'
import type { NodeExternalsOptions } from './rollup/plugins/externals'
import type { StorageOptions } from './rollup/plugins/storage'
import type { AssetOptions } from './rollup/plugins/assets'
import type { ServerMiddleware } from './server/middleware'

export interface NitroContext {
  timing: boolean
  inlineDynamicImports: boolean
  minify: boolean
  sourceMap: boolean
  externals: boolean | NodeExternalsOptions
  analyze: boolean
  entry: string
  node: boolean
  preset: string
  rollupConfig?: any
  renderer: string
  serveStatic: boolean
  middleware: ServerMiddleware[]
  scannedMiddleware: ServerMiddleware[]
  hooks: configHooksT
  nuxtHooks: configHooksT
  ignore: string[]
  env: Preset
  output: {
    dir: string
    serverDir: string
    publicDir: string
  }
  storage: StorageOptions,
  assets: AssetOptions,
  _nuxt: {
    majorVersion: number
    dev: boolean
    rootDir: string
    srcDir: string
    buildDir: string
    generateDir: string
    staticDir: string
    serverDir: string
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

export interface NitroInput extends DeepPartial<NitroContext> {}

export type NitroPreset = NitroInput | ((input: NitroInput) => NitroInput)

export function getNitroContext (nuxtOptions: NuxtOptions, input: NitroInput): NitroContext {
  const defaults: NitroContext = {
    timing: undefined,
    inlineDynamicImports: undefined,
    minify: undefined,
    sourceMap: undefined,
    externals: undefined,
    analyze: undefined,
    entry: undefined,
    node: undefined,
    preset: undefined,
    rollupConfig: undefined,
    renderer: undefined,
    serveStatic: undefined,
    middleware: [],
    scannedMiddleware: [],
    ignore: [],
    env: {},
    hooks: {},
    nuxtHooks: {},
    output: {
      dir: '{{ _nuxt.rootDir }}/.output',
      serverDir: '{{ output.dir }}/server',
      publicDir: '{{ output.dir }}/public'
    },
    storage: { mounts: { } },
    assets: {
      inline: !nuxtOptions.dev,
      dirs: {}
    },
    _nuxt: {
      majorVersion: nuxtOptions._majorVersion || 2,
      dev: nuxtOptions.dev,
      rootDir: nuxtOptions.rootDir,
      srcDir: nuxtOptions.srcDir,
      buildDir: nuxtOptions.buildDir,
      generateDir: nuxtOptions.generate.dir,
      staticDir: nuxtOptions.dir.static,
      serverDir: resolve(nuxtOptions.srcDir, (nuxtOptions.dir as any).server || 'server'),
      routerBase: nuxtOptions.router.base,
      publicPath: nuxtOptions.build.publicPath,
      isStatic: nuxtOptions.target === 'static' && !nuxtOptions.dev,
      fullStatic: nuxtOptions.target === 'static' && !nuxtOptions._legacyGenerate,
      staticAssets: nuxtOptions.generate.staticAssets,
      runtimeConfig: {
        public: nuxtOptions.publicRuntimeConfig,
        private: nuxtOptions.privateRuntimeConfig
      }
    },
    _internal: {
      runtimeDir: resolve(dirname(require.resolve('@nuxt/nitro')), 'runtime'),
      hooks: new Hookable()
    }
  }

  defaults.preset = input.preset || process.env.NITRO_PRESET || detectTarget() || 'server'
  let presetDefaults = PRESETS[defaults.preset] || tryImport(nuxtOptions.rootDir, defaults.preset)
  if (!presetDefaults) {
    throw new Error('Cannot resolve preset: ' + defaults.preset)
  }
  presetDefaults = presetDefaults.default || presetDefaults

  const _presetInput = defu(input, defaults)
  const _preset = (extendPreset(presetDefaults /* base */, input) as Function)(_presetInput)
  const nitroContext: NitroContext = defu(_preset, defaults) as any

  nitroContext.output.dir = resolvePath(nitroContext, nitroContext.output.dir)
  nitroContext.output.publicDir = resolvePath(nitroContext, nitroContext.output.publicDir)
  nitroContext.output.serverDir = resolvePath(nitroContext, nitroContext.output.serverDir)

  nitroContext._internal.hooks.addHooks(nitroContext.hooks)

  // Dev-only storage
  if (nitroContext._nuxt.dev) {
    const fsMounts = {
      root: resolve(nitroContext._nuxt.rootDir),
      src: resolve(nitroContext._nuxt.srcDir),
      build: resolve(nitroContext._nuxt.buildDir),
      cache: resolve(nitroContext._nuxt.rootDir, '.nuxt/nitro/cache')
    }
    for (const p in fsMounts) {
      nitroContext.storage.mounts[p] = nitroContext.storage.mounts[p] || {
        driver: 'fs',
        driverOptions: { base: fsMounts[p] }
      }
    }
  }

  // Assets
  nitroContext.assets.dirs.server = {
    dir: resolve(nitroContext._nuxt.rootDir, 'server/assets'), meta: true
  }

  // console.log(nitroContext)
  // process.exit(1)

  return nitroContext
}
