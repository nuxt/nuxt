import { resolve } from 'path'
import defu from 'defu'
import type { NuxtOptions } from '@nuxt/types'
import Hookable, { configHooksT } from 'hookable'
import { tryImport, resolvePath, detectTarget, extendTarget } from './utils'
import * as TARGETS from './targets'

// eslint-disable-next-line
export type UnresolvedPath = string | ((config: SLSOptions) => string)

export interface Nuxt extends Hookable{
  options: NuxtOptions
}

export interface ServerMiddleware {
  route: string
  handle: string
  lazy?: boolean
}

export interface SLSOptions {
  hooks: configHooksT
  nuxtHooks: configHooksT

  rootDir: string
  buildDir: string
  publicDir: string
  routerBase: string
  publicPath: string
  fullStatic: boolean
  staticAssets: any

  entry: UnresolvedPath
  outName: string
  node: false | true
  target: string
  minify: boolean
  externals: boolean
  rollupConfig?: any
  timing: boolean
  inlineChunks: boolean
  renderer: string
  analyze: boolean
  cleanTargetDir: boolean

  runtimeDir: string
  slsDir: string
  targetDir: string

  serverMiddleware: ServerMiddleware[],

  static: string[]
  generateIgnore: string[]
}

export interface SLSConfig extends Omit<Partial<SLSOptions>, 'targetDir'> {
  targetDir?: UnresolvedPath
}

export type SLSTargetFn = (config: SLSConfig) => SLSConfig
export type SLSTarget = SLSConfig | SLSTargetFn

export function getoptions (nuxtOptions: Nuxt['options'], serverless: SLSConfig): SLSOptions {
  const defaults: SLSConfig = {
    rootDir: nuxtOptions.rootDir,
    buildDir: nuxtOptions.buildDir,
    publicDir: nuxtOptions.generate.dir,
    routerBase: nuxtOptions.router.base,
    publicPath: nuxtOptions.build.publicPath,
    fullStatic: nuxtOptions.target === 'static' && !nuxtOptions._legacyGenerate,
    // @ts-ignore
    staticAssets: nuxtOptions.generate.staticAssets,

    outName: '_nuxt.js',
    timing: true,
    inlineChunks: true,
    minify: false,
    externals: false,
    cleanTargetDir: true,

    runtimeDir: resolve(__dirname, '../runtime'),
    slsDir: '{{ rootDir }}/.nuxt/serverless',
    targetDir: '{{ slsDir }}/{{ target }}',

    serverMiddleware: serverless.serverMiddleware || [],

    static: [],
    generateIgnore: []
  }

  const target = serverless.target || process.env.NUXT_SLS_TARGET || detectTarget()
  let targetDefaults = TARGETS[target] || tryImport(nuxtOptions.rootDir, target)
  if (!targetDefaults) {
    throw new Error('Cannot resolve target: ' + target)
  }
  targetDefaults = targetDefaults.default || targetDefaults

  const _defaults = defu(defaults, { target })
  const _targetInput = defu(nuxtOptions.serverless, _defaults)
  const _target = extendTarget(nuxtOptions.serverless, targetDefaults)(_targetInput)
  const options: SLSOptions = defu(nuxtOptions.serverless, _target, _defaults)

  options.slsDir = resolvePath(options, options.slsDir)
  options.targetDir = resolvePath(options, options.targetDir)
  options.publicDir = resolvePath(options, options.publicDir)

  return options
}
