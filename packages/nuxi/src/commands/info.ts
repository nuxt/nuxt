import os from 'os'
import { existsSync, readFileSync } from 'fs'
import { createRequire } from 'module'
import { resolve, dirname } from 'pathe'
import jiti from 'jiti'
import destr from 'destr'
import { splitByCase } from 'scule'
import clipboardy from 'clipboardy'
import { defineNuxtCommand } from './index'

export default defineNuxtCommand({
  meta: {
    name: 'info',
    usage: 'npx nuxi info [rootDir]',
    description: 'Get information about nuxt project'
  },
  async invoke (args) {
    // Resolve rootDir
    const rootDir = resolve(args._[0] || '.')

    // Load nuxt.config
    const nuxtConfig = getNuxtConfig(rootDir)

    // Find nearest package.json
    const { dependencies = {}, devDependencies = {} } = findPackage(rootDir)

    // Utils to query a dependency version
    const getDepVersion = name => getPkg(name, rootDir)?.version || dependencies[name] || devDependencies[name]

    const listModules = (arr = []) => arr
      .map(normalizeConfigModule)
      .filter(Boolean)
      .map((name) => {
        const npmName = name.split('/').splice(0, 2).join('/') // @foo/bar/baz => @foo/bar
        const v = getDepVersion(npmName)
        return '`' + (v ? `${name}@${v}` : name) + '`'
      })
      .join(', ')

    // Check nuxt version
    const nuxtVersion = getDepVersion('nuxt') || getDepVersion('nuxt-edge') || getDepVersion('nuxt3') || '0.0.0'
    const isNuxt3 = nuxtVersion.startsWith('3')
    const useVite = isNuxt3
      ? nuxtConfig.vite !== false
      : (nuxtConfig?.buildModules?.find(m => m === 'nuxt-vite'))

    const infoObj = {
      OperatingSystem: os.type(),
      NodeVersion: process.version,
      NuxtVersion: nuxtVersion,
      PackageManager: getPackageManager(rootDir),
      Bundler: useVite ? 'Vite' : 'Webpack',
      UserConfig: Object.keys(nuxtConfig).map(key => '`' + key + '`').join(', '),
      RuntimeModules: listModules(nuxtConfig.modules),
      BuildModules: listModules(nuxtConfig.buildModules)
    }

    console.log('RootDir:', rootDir)

    let maxLength = 0
    const entries = Object.entries(infoObj).map(([key, val]) => {
      const label = splitByCase(key).join(' ')
      if (label.length > maxLength) { maxLength = label.length }
      return [label, val || '-']
    })
    let infoStr = ''
    for (const [label, value] of entries) {
      infoStr += '- ' + (label + ': ').padEnd(maxLength + 2) + (value.includes('`') ? value : '`' + value + '`') + '\n'
    }

    const copied = await clipboardy.write(infoStr).then(() => true).catch(() => false)
    const splitter = '------------------------------'
    console.log(`Nuxt project info: ${copied ? '(copied to clipboard)' : ''}\n\n${splitter}\n${infoStr}${splitter}\n`)

    const isNuxt3OrBridge = infoObj.NuxtVersion.startsWith('3') || infoObj.BuildModules.includes('bridge')
    const repo = isNuxt3OrBridge ? 'nuxt/framework' : 'nuxt/nuxt.js'
    console.log([
      `👉 Report an issue: https://github.com/${repo}/issues/new`,
      `👉 Suggest an improvement: https://github.com/${repo}/discussions/new`,
      `👉 Read documentation: ${isNuxt3OrBridge ? 'https://v3.nuxtjs.org' : 'https://nuxtjs.org'}`
    ].join('\n\n') + '\n')
  }
})

function normalizeConfigModule (module, rootDir) {
  if (!module) {
    return null
  }
  if (typeof module === 'string') {
    return module
      .split(rootDir).pop() // Strip rootDir
      .split('node_modules').pop() // Strip node_modules
      .replace(/^\//, '')
  }
  if (typeof module === 'function') {
    return `${module.name}()`
  }
  if (Array.isArray(module)) {
    return normalizeConfigModule(module[0], rootDir)
  }
}

function findup (rootDir, fn) {
  let dir = rootDir
  while (dir !== dirname(dir)) {
    const res = fn(dir)
    if (res) {
      return res
    }
    dir = dirname(dir)
  }
  return null
}

function getPackageManager (rootDir) {
  return findup(rootDir, (dir) => {
    if (existsSync(resolve(dir, 'yarn.lock'))) {
      return 'Yarn'
    }
    if (existsSync(resolve(dir, 'package-lock.json'))) {
      return 'npm'
    }
  }) || 'unknown'
}

function getNuxtConfig (rootDir) {
  try {
    return jiti(rootDir, { interopDefault: true })('./nuxt.config')
  } catch (err) {
    // TODO: Show error as warning if it is not 404
    return {}
  }
}

function getPkg (name, rootDir) {
  // Assume it is in {rootDir}/node_modules/${name}/package.json
  let pkgPath = resolve(rootDir, 'node_modules', name, 'package.json')

  // Try to resolve for more accuracy
  const _require = createRequire(rootDir)
  try { pkgPath = _require.resolve(name + '/package.json') } catch (_err) {
    // console.log('not found:', name)
  }

  return readJSONSync(pkgPath)
}

function findPackage (rootDir) {
  return findup(rootDir, (dir) => {
    const p = resolve(dir, 'package.json')
    if (existsSync(p)) {
      return readJSONSync(p)
    }
  }) || {}
}

function readJSONSync (filePath) {
  try {
    return destr(readFileSync(filePath, 'utf-8'))
  } catch (err) {
    // TODO: Warn error
    return null
  }
}
