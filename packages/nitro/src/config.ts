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
  node: false
  target: string
  minify: boolean
  rollupConfig?: any
  logStartup: boolean
  inlineChunks: boolean
  renderer: string
  analyze: boolean

  runtimeDir: string
  slsDir: string
  targetDir: string

  static: string[]
  generateIgnore: string[]
}

export interface SLSConfig extends Omit<Partial<SLSOptions>, 'targetDir'> {
  targetDir?: UnresolvedPath
}

export type SLSTargetFn = (config: SLSConfig) => SLSConfig
export type SLSTarget = SLSConfig | SLSTargetFn

interface SLSNuxt extends Nuxt {
  options: Nuxt['options'] & {
    generate: Nuxt['options']['generate'] & {
      staticAssets: string[]
    }
  }
}

export function getoptions (nuxt: SLSNuxt): SLSOptions {
  const defaults: SLSConfig = {
    rootDir: nuxt.options.rootDir,
    buildDir: nuxt.options.buildDir,
    publicDir: nuxt.options.generate.dir,
    routerBase: nuxt.options.router.base,
    publicPath: nuxt.options.build.publicPath,
    fullStatic: nuxt.options.target === 'static' && !nuxt.options._legacyGenerate,
    staticAssets: nuxt.options.generate.staticAssets,

    outName: '_nuxt.js',
    logStartup: true,
    inlineChunks: true,

    runtimeDir: resolve(__dirname, '../runtime'),
    slsDir: '{{ rootDir }}/.nuxt/serverless',
    targetDir: '{{ slsDir }}/{{ target }}',

    static: [],
    generateIgnore: []
  }

  const target = process.env.NUXT_SLS_TARGET || (nuxt.options.serverless || {}).target || detectTarget()
  let targetDefaults = TARGETS[target] || tryImport(nuxt.options.rootDir, target)
  if (!targetDefaults) {
    throw new Error('Cannot resolve target: ' + target)
  }
  targetDefaults = targetDefaults.default || targetDefaults

  const _defaults = defu(defaults, { target })
  const _targetInput = defu(nuxt.options.serverless, _defaults)
  const _target = extendTarget(nuxt.options.serverless, targetDefaults)(_targetInput)
  const options: SLSOptions = defu(nuxt.options.serverless, _target, _defaults)

  options.slsDir = resolvePath(options, options.slsDir)
  options.targetDir = resolvePath(options, options.targetDir)
  options.publicDir = resolvePath(options, options.publicDir)

  return options
}
