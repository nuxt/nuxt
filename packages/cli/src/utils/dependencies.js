import consola from 'consola'
import { satisfies } from 'semver'

import { getPKG } from '@nuxt/utils'

export function checkDependencies () {
  const dependencies = {
    postcss: '^7.0.32',
    webpack: '^4.46.0'
  }

  const optionalDependencies = {
    'sass-loader': '^10.1.1'
  }

  const versions = {
    ...dependencies,
    ...optionalDependencies
  }

  Object.entries(versions).forEach(([name, requiredVersion]) => {
    try {
      const installedVersion = getPKG(name).version
      if (!satisfies(installedVersion, requiredVersion)) {
        consola.error(
          `Required version of ${name} (${requiredVersion}) not installed. (${installedVersion} was detected.)`
        )
      }
    } catch {
      if (!Object.keys(optionalDependencies).includes(name)) {
        consola.warn(`Expected ${name}@${requiredVersion} to be installed.`)
      }
    }
  })

  // Check Node version
  if (satisfies(process.version, '^10.0.0')) {
    consola.warn('Node.js 10 is deprecated and will shortly not be supported.')
  } else if (!satisfies(process.version, '>12.0.0')) {
    consola.warn('Please use a supported version of Node.js (12+).')
  }
}
