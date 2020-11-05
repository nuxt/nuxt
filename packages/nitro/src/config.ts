import { resolve } from 'path'
import defu from 'defu'
import { NuxtOptions } from '@nuxt/types'
import { tryImport, LIB_DIR } from './utils'

export interface SLSConfig {
  node: false
  entry: string
  outDir: string
  slsDir: string
  outName: string
  logStartup: boolean
  buildDir: string
  publicDir: string
  staticDir: string
  rootDir: string
  targets: ((SLSConfig & { target: string }) | string)[]
  target: string
  templates: string[]
  renderer: string
  nuxt: 2 | 3
  analyze: boolean
  minify: boolean
}

export function getBaseConfig (options: NuxtOptions): SLSConfig {
  const baseConfig = {
    rootDir: options.rootDir,
    buildDir: options.buildDir,
    publicDir: options.generate.dir,
    slsDir: null,
    targets: [],
    templates: [],
    static: [
      '/about'
    ],
    nuxt: 2,
    target: null,
    minify: null,
    analyze: null,
    logStartup: true,
    ...options.serverless
  }

  baseConfig.buildDir = resolve(baseConfig.rootDir, baseConfig.buildDir || '.nuxt')
  baseConfig.publicDir = resolve(baseConfig.rootDir, baseConfig.publicDir || 'dist')
  baseConfig.slsDir = resolve(baseConfig.rootDir, baseConfig.slsDir || '.sls')

  baseConfig.targets = baseConfig.targets.map(t => typeof t === 'string' ? { target: t } : t)
  if (baseConfig.target && !baseConfig.targets.find(t => t.target === baseConfig.target)) {
    baseConfig.targets.push({ target: baseConfig.target })
  }

  return baseConfig
}

export function getTargetConfig (baseConfig: SLSConfig, target: SLSConfig) {
  const _targetDefaults = tryImport(LIB_DIR, `./targets/${target.target}`) ||
    tryImport(baseConfig.rootDir, target.target)
  if (!_targetDefaults) {
    throw new Error('Cannot resolve target: ' + target.target)
  }

  // TODO: Merge hooks

  return defu(
    // Target specific config by user
    target,
    // Global user config
    baseConfig,
    // Target defaults
    _targetDefaults,
    // Generic defaults
    {
      targetDir: resolve(baseConfig.slsDir, target.target),
      outName: 'index.js'
    }
  )
}
