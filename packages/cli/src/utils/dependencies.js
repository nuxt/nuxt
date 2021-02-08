import consola from 'consola'
import { satisfies } from 'semver'

import { getPKG } from '@nuxt/utils'

export function checkDependencies () {
  const constraints = {
    dependencies: {
      postcss: {
        range: '^7.0.32'
      },
      webpack: { range: '^4.46.0' }
    },
    optionalDependencies: {
      'sass-loader': { range: '^10.1.1' }
    },
    engines: {
      node: {
        range: '>12.0.0',
        message:
          'You are using an unsupported version of Node.js (x.y.z) and Nuxt is likely to be broken. It is recommended to use the latest LTS version (https://nodejs.org)'
      }
    }
  }

  const packageVersions = {
    ...constraints.dependencies,
    ...constraints.optionalDependencies
  }

  Object.entries(packageVersions).forEach(([name, { range: requiredVersion, message }]) => {
    try {
      const installedVersion = getPKG(name).version
      if (!satisfies(installedVersion, requiredVersion)) {
        consola.error(message ||
          `Required version of ${name} (${requiredVersion}) not installed. (${installedVersion} was detected.)`
        )
      }
    } catch {
      if (!Object.keys(constraints.optionalDependencies).includes(name)) {
        consola.warn(message || `Expected ${name}@${requiredVersion} to be installed.`)
      }
    }
  })

  // Check Node versions
  if (!satisfies(process.version, constraints.engines.node.range)) {
    consola.warn(constraints.engines.node.message.replace('x.y.z', process.version))
  }
}
