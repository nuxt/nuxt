/* eslint-disable no-use-before-define */
import { resolve } from 'pathe'
import defu from 'defu'
import { createHooks, Hookable, NestedHooks } from 'hookable'
import type { Preset } from 'unenv'
import type { NuxtHooks, NuxtOptions } from '@nuxt/kit'
import { tryImport, resolvePath, detectTarget, extendPreset } from './utils'
import * as PRESETS from './presets'
import type { NodeExternalsOptions } from './rollup/plugins/externals'
import type { StorageOptions } from './rollup/plugins/storage'
import type { AssetOptions } from './rollup/plugins/assets'
import type { ServerMiddleware } from './server/middleware'
import type { RollupConfig } from './rollup/config'
import type { Options as EsbuildOptions } from './rollup/plugins/esbuild'
import { runtimeDir } from './dirs'

export interface NitroHooks {
  'nitro:document': (htmlTemplate: { src: string, contents: string, dst: string }) => void
  'nitro:rollup:before': (context: NitroContext) => void | Promise<void>
  'nitro:compiled': (context: NitroContext) => void
  'close': () => void
}

export interface NitroContext {
  alias: Record<string, string>
  timing: boolean
  inlineDynamicImports: boolean
  minify: boolean
  sourceMap: boolean
  externals: boolean | NodeExternalsOptions
  analyze: boolean
  entry: string
  node: boolean
  preset: string
  rollupConfig?: RollupConfig
  esbuild?: {
    options?: EsbuildOptions
  }
  experiments?: {
    wasm?: boolean
  }
  moduleSideEffects: string[]
  renderer: string
  serveStatic: boolean
  middleware: ServerMiddleware[]
  scannedMiddleware: ServerMiddleware[]
  hooks: NestedHooks<NitroHooks>
  nuxtHooks: NestedHooks<NuxtHooks>
  ignore: string[]
  env: Preset
  vfs: Record<string, string>
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
    ssr: boolean
    rootDir: string
    srcDir: string
    buildDir: string
    generateDir: string
    publicDir: string
    serverDir: string
    routerBase: string
    publicPath: string
    isStatic: boolean
    fullStatic: boolean
    staticAssets: any
    modulesDir: string[]
    runtimeConfig: { public: any, private: any }
  }
  _internal: {
    runtimeDir: string
    hooks: Hookable<NitroHooks>
  }
}

type DeepPartial<T> = T extends Record<string, any> ? { [P in keyof T]?: DeepPartial<T[P]> | T[P] } : T

export interface NitroInput extends DeepPartial<NitroContext> {}

export type NitroPreset = NitroInput | ((input: NitroInput) => NitroInput)

export function getNitroContext (nuxtOptions: NuxtOptions, input: NitroInput): NitroContext {
  const defaults: NitroContext = {
    alias: {},
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
    experiments: {},
    moduleSideEffects: ['unenv/runtime/polyfill/'],
    renderer: undefined,
    serveStatic: undefined,
    middleware: [],
    scannedMiddleware: [],
    ignore: [],
    env: {},
    vfs: {},
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
      ssr: nuxtOptions.ssr,
      rootDir: nuxtOptions.rootDir,
      srcDir: nuxtOptions.srcDir,
      buildDir: nuxtOptions.buildDir,
      generateDir: nuxtOptions.generate.dir,
      publicDir: resolve(nuxtOptions.srcDir, nuxtOptions.dir.public || nuxtOptions.dir.static),
      serverDir: resolve(nuxtOptions.srcDir, (nuxtOptions.dir as any).server || 'server'),
      routerBase: nuxtOptions.router.base,
      publicPath: nuxtOptions.build.publicPath,
      isStatic: nuxtOptions.target === 'static' && !nuxtOptions.dev,
      fullStatic: nuxtOptions.target === 'static' && !nuxtOptions._legacyGenerate,
      staticAssets: nuxtOptions.generate.staticAssets,
      modulesDir: nuxtOptions.modulesDir,
      runtimeConfig: {
        public: nuxtOptions.publicRuntimeConfig,
        private: nuxtOptions.privateRuntimeConfig
      }
    },
    _internal: {
      runtimeDir,
      hooks: createHooks<NitroHooks>()
    }
  }

  defaults.preset = input.preset || process.env.NITRO_PRESET || detectTarget() || 'server'
  // eslint-disable-next-line import/namespace
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
    dir: resolve(nitroContext._nuxt.srcDir, 'server/assets'), meta: true
  }

  // console.log(nitroContext)
  // process.exit(1)

  return nitroContext
}
