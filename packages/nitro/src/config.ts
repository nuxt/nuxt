import { resolve } from 'path'
import defu from 'defu'
import type { NuxtOptions } from '@nuxt/types'
import { tryImport, resolvePath, detectTarget } from './utils'
import * as TARGETS from './targets'

export type UnresolvedPath = string | ((SLSOptions) => string)

export interface SLSOptions {
  nuxtOptions: NuxtOptions
  node: false
  target: string
  entry: UnresolvedPath
  slsDir: string
  outName: string
  logStartup: boolean
  inlineChunks: boolean
  buildDir: string
  publicDir: string
  staticDir: string
  targetDir: string
  rootDir: string
  runtimeDir: string
  static: string[]
  renderer: string
  nuxt: 2 | 3
  analyze: boolean
  minify: boolean
  rollupConfig?: any
  fullStatic: boolean,
  generateIgnore: string[]
  staticAssets: {
    base: string
    versionBase: string
    dir: string
    version: string
  }
  hooks: { [key: string]: any } // TODO: export from hookable
  nuxtHooks: { [key: string]: Function } // NuxtOptions['hooks']
}

export interface SLSConfig extends Omit<Partial<SLSOptions>, 'targetDir'> {
  targetDir: UnresolvedPath
}

export type SLSTarget = Partial<SLSConfig> | ((NuxtOptions) => Partial<SLSConfig>)

export function getoptions (nuxtOptions: NuxtOptions): SLSOptions {
  const defaults: SLSConfig = {
    rootDir: nuxtOptions.rootDir,
    buildDir: nuxtOptions.buildDir,
    publicDir: nuxtOptions.generate.dir,
    fullStatic: nuxtOptions.target === 'static' && !nuxtOptions._legacyGenerate,
    // @ts-ignore
    staticAssets: nuxtOptions.generate.staticAssets,
    outName: '_nuxt.js',
    runtimeDir: resolve(__dirname, '../runtime'),
    static: [],
    generateIgnore: [],
    nuxt: 2,
    logStartup: true,
    inlineChunks: true,
    targetDir: null
  }

  let target = process.env.NUXT_SLS_TARGET || nuxtOptions.serverless?.target || detectTarget()
  if (typeof target === 'function') {
    target = target(nuxtOptions)
  }

  let targetDefaults = TARGETS[target] || tryImport(nuxtOptions.rootDir, target)
  if (!targetDefaults) {
    throw new Error('Cannot resolve target: ' + target)
  }
  targetDefaults = targetDefaults.default || targetDefaults
  if (typeof targetDefaults === 'function') {
    targetDefaults = targetDefaults(nuxtOptions)
  }

  const options: SLSOptions = defu(nuxtOptions.serverless, targetDefaults, defaults, { target })

  options.buildDir = resolve(options.rootDir, options.buildDir || '.nuxt')
  options.publicDir = resolve(options.rootDir, options.publicDir || 'dist')
  options.slsDir = resolve(options.rootDir, options.slsDir || '.sls')
  options.targetDir = options.targetDir ? resolvePath(options, options.targetDir) : resolve(options.slsDir, target)

  return options
}
