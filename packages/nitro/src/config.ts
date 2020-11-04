import { resolve } from 'path'
import defu from 'defu'
import { tryImport, LIB_DIR } from './utils'

export function getBaseConfig (rootDir) {
  let baseConfig = {
    rootDir,
    buildDir: '',
    publicDir: '',
    staticDir: '',
    targets: [],
    templates: [],
    nuxt: 2,
    target: process.argv[3] && process.argv[3][0] !== '-' ? process.argv[3] : null,
    minify: process.argv.includes('--minify') ? true : null,
    analyze: process.argv.includes('--analyze') ? true : null,
    logStartup: true
  }

  const nuxtConfig = tryImport(rootDir, './nuxt.config')
  if (!nuxtConfig) {
    throw new Error('`nuxt.config` file not found in: ' + rootDir)
  }
  if (nuxtConfig.serverless) {
    baseConfig = defu(nuxtConfig.serverless, baseConfig)
  }

  baseConfig.buildDir = resolve(baseConfig.rootDir, baseConfig.buildDir || '.nuxt')
  baseConfig.publicDir = resolve(baseConfig.rootDir, baseConfig.publicDir || 'dist')
  baseConfig.staticDir = resolve(baseConfig.rootDir, baseConfig.staticDir || 'static')

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
      outDir: resolve(baseConfig.buildDir, `sls/${target.target}`),
      outName: 'index.js'
    }
  )
}
