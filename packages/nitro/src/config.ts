import { resolve } from 'path'
import defu from 'defu'
import { tryImport, LIB_DIR } from './utils'

export function getBaseConfig (options) {
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

export function getTargetConfig (baseConfig, target) {
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
