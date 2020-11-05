import { resolve } from 'path'
import defu from 'defu'
import { NuxtOptions } from '@nuxt/types'
import { tryImport, LIB_DIR } from './utils'

export interface SLSOptions {
  node: false
  target: 'worker' | 'node' | string
  entry: string
  outDir: string
  slsDir: string
  outName: string
  logStartup: boolean
  inlineChunks: boolean
  buildDir: string
  publicDir: string
  staticDir: string
  targetDir: string
  rootDir: string
  templates: { src: string, dst: string }[]
  static: string[]
  renderer: string
  nuxt: 2 | 3
  analyze: boolean
  minify: boolean
  rollupConfig?: any
  fullStatic: boolean,
  staticAssets: {
    base: string
    versionBase: string
    dir: string
    version: string
  }
  hooks: { [key: string]: any } // TODO: export from hookable
}

export interface SLSConfig extends Partial<SLSOptions> {}

export function getoptions (nuxtOptions: NuxtOptions): SLSOptions {
  const defaults: SLSConfig = {
    rootDir: nuxtOptions.rootDir,
    buildDir: nuxtOptions.buildDir,
    publicDir: nuxtOptions.generate.dir,
    fullStatic: nuxtOptions.target === 'static' && !nuxtOptions._legacyGenerate,
    // @ts-ignore
    staticAssets: nuxtOptions.generate.staticAssets,
    outName: 'server.js',
    templates: [],
    static: [],
    nuxt: 2,
    logStartup: true,
    inlineChunks: true
  }

  if (Array.isArray(nuxtOptions.generate.routes)) {
    defaults.static = nuxtOptions.generate.routes
  }

  let target = process.env.NUXT_SLS_TARGET || nuxtOptions.serverless.target || 'node'
  if (typeof target === 'function') {
    target = target(nuxtOptions)
  }
  let targetDefaults = tryImport(LIB_DIR, `./targets/${target}`) || tryImport(nuxtOptions.rootDir, target)
  if (!targetDefaults) {
    throw new Error('Cannot resolve target: ' + target)
  }
  targetDefaults = targetDefaults.default || targetDefaults

  const options: SLSOptions = defu(nuxtOptions.serverless, targetDefaults, defaults, { target })

  options.buildDir = resolve(options.rootDir, options.buildDir || '.nuxt')
  options.publicDir = resolve(options.rootDir, options.publicDir || 'dist')
  options.slsDir = resolve(options.rootDir, options.slsDir || '.sls')
  options.targetDir = resolve(options.slsDir, target)

  return options
}
