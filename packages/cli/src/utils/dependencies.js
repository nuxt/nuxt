import consola from 'consola'
import { satisfies } from 'semver'
import { getPKG } from '@nuxt/utils'

const dependencies = {
  webpack: '^4.46.0',
  'css-loader': '>=4.2.0',
  'sass-loader': '^10.1.1'
}

const nodeVersion = '>=14.18.0'

function getInstalledVersion (name) {
  try {
    return getPKG(name).version
  } catch { }
}

export function checkDependencies () {
  for (const name in dependencies) {
    const installedVersion = getInstalledVersion(name)
    if (!installedVersion) {
      continue // Ignore to avoid false-positive warnings
    }
    const expectedRange = dependencies[name]
    if (!satisfies(installedVersion, expectedRange)) {
      consola.warn(`${name}@${installedVersion} is installed but ${expectedRange} is expected`)
    }
  }

  // Check Node versions
  if (!satisfies(process.version, nodeVersion)) {
    consola.warn(`You are using an unsupported version of Node.js (${process.version}). It is recommended to use the latest LTS version (https://nodejs.org/en/about/releases)`)
  }
}
