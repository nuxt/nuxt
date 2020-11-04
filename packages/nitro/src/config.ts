import { resolve } from 'path'
import { tryImport } from './utils'

export function getBaseConfig (rootDir) {
  const baseConfig = {
    rootDir,
    buildDir: '',
    targets: [],
    templates: [],
    nuxt: 2,
    target: process.argv[3] && process.argv[3][0] !== '-' ? process.argv[3] : null,
    minify: process.argv.includes('--minify') ? true : null,
    analyze: process.argv.includes('--analyze') ? true : null,
    logStartup: true
  }

  Object.assign(baseConfig, tryImport(rootDir, './nuxt.config')!.serverless)

  baseConfig.buildDir = resolve(baseConfig.rootDir, baseConfig.buildDir || '.nuxt')

  baseConfig.targets = baseConfig.targets.map(t => typeof t === 'string' ? { target: t } : t)
  if (baseConfig.target && !baseConfig.targets.find(t => t.target === baseConfig.target)) {
    baseConfig.targets.push({ target: baseConfig.target })
  }

  return baseConfig
}
