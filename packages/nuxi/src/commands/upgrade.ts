import { execSync } from 'node:child_process'
import consola from 'consola'
import { resolve } from 'pathe'
import { getPackageManager, packageManagerLocks } from '../utils/packageManagers'
import { rmRecursive, touchFile } from '../utils/fs'
import { createGetDepVersion, getPkg } from '../utils/packages'
import { cleanupNuxtDirs, nuxtVersionToGitIdentifier } from '../utils/nuxt'
import { defineNuxtCommand } from './index'

const UNKNOWN_VERSION = '[unknown]'

function getNuxtVersion (rootDir: string): string {
  try {
    const getDepVersion = createGetDepVersion(rootDir)
    const nuxtVersion = getDepVersion('nuxt') || getDepVersion('nuxt-edge') || getDepVersion('nuxt3')
    return nuxtVersion || UNKNOWN_VERSION
  } catch {
    return UNKNOWN_VERSION
  }
}

function detectLegacyNuxt3 (rootDir: string): boolean {
  try {
    const legacyNuxt3 = getPkg('nuxt3', rootDir)
    return (typeof legacyNuxt3?.version === 'string')
  } catch {
    return false
  }
}

function detectNuxtEdge (nuxtVersion: string): boolean {
  try {
    return (/-\d{8}.[a-z0-9]{7}/).test(nuxtVersion)
  } catch {
    return false
  }
}

export default defineNuxtCommand({
  meta: {
    name: 'upgrade',
    usage: 'npx nuxi upgrade [--force|-f] [--channel=stable|edge]',
    description: 'Upgrade nuxt'
  },
  async invoke (args) {
    const rootDir = resolve(args._[0] || '.')

    // Check package manager
    const packageManager = getPackageManager(rootDir)
    if (!packageManager) {
      console.error('Cannot detect Package Manager in', rootDir)
      process.exit(1)
    }
    const packageManagerVersion = execSync(`${packageManager} --version`).toString('utf8').trim()
    consola.info('Package Manager:', packageManager, packageManagerVersion)

    // Check currently installed nuxt version and detect edge releases
    const currentVersion = getNuxtVersion(rootDir)
    const isLegacyNuxt3 = detectLegacyNuxt3(rootDir)
    const isNuxtEdge = detectNuxtEdge(currentVersion)
    // Decide to set needed nuxt version as 3
    const isNuxt3 = currentVersion.startsWith('3') || currentVersion === UNKNOWN_VERSION

    // Display information message to a user
    if (isNuxtEdge) {
      consola.info(`Current nuxt version: ${currentVersion}, edge release channel detected`)
    } else {
      consola.info(`Current nuxt version: ${currentVersion}`)
    }

    // Warn user to add alias to nuxt3 package or install stable rc version
    if (isLegacyNuxt3) {
      consola.warn('`nuxt3` package usage without alias is removed.\nPlease, update your code to continue working with new releases.\nSee more: https://github.com/nuxt/framework/pull/4449')
    }

    // Force install
    if (args.force || args.f) {
      consola.info('Removing lock-file and node_modules...')
      const pmLockFile = resolve(rootDir, packageManagerLocks[packageManager])
      await rmRecursive([pmLockFile, resolve(rootDir, 'node_modules')])
      await touchFile(pmLockFile)
    }

    const updatedNuxtPackageName = (() => {
      let installEdgeChannel = isNuxtEdge
      // Switch channel only if specific flags explicitly set
      if (args.channel === 'stable') {
        installEdgeChannel = false
      } else if (args.channel === 'edge') {
        installEdgeChannel = true
      }
      // Nuxt 3 with 'nuxt3' package name
      if (isLegacyNuxt3) {
        return 'nuxt3@latest'
      }
      // Nuxt 3 Stable
      if (isNuxt3 && !installEdgeChannel) {
        return 'nuxt@3'
      }
      // Nuxt 3 Edge
      if (isNuxt3 && installEdgeChannel) {
        return 'nuxt@npm:nuxt3@latest'
      }
      // Nuxt 2 Stable
      if (!isNuxt3 && !installEdgeChannel) {
        return 'nuxt@2'
      }
      // Nuxt 2 Edge
      if (!isNuxt3 && installEdgeChannel) {
        return 'nuxt-edge'
      }
      return 'nuxt@3'
    })()

    // Detect switching Nuxt 2 releases
    if ((!isNuxt3 && isNuxtEdge) && args.channel === 'stable') {
      consola.info('Uninstalling previouus Nuxt')
      execSync(`${packageManager} ${packageManager === 'yarn' ? 'remove' : 'uninstall'} -S nuxt-edge`, { stdio: 'inherit', cwd: rootDir })
    }
    if ((!isNuxt3 && !isNuxtEdge) && args.channel === 'edge') {
      consola.info('Uninstalling previouus Nuxt')
      execSync(`${packageManager} ${packageManager === 'yarn' ? 'remove' : 'uninstall'} -S nuxt`, { stdio: 'inherit', cwd: rootDir })
    }

    // Install latest version
    consola.info('Installing latest Nuxt 3 release...')
    execSync(`${packageManager} ${packageManager === 'yarn' ? 'add' : 'install'} -D ${updatedNuxtPackageName}`, { stdio: 'inherit', cwd: rootDir })

    // Cleanup after upgrade
    await cleanupNuxtDirs(rootDir)

    // Check installed nuxt version again
    const upgradedVersion = getNuxtVersion(rootDir) || '[unknown]'
    consola.info('Upgraded nuxt version:', upgradedVersion)

    if (upgradedVersion === currentVersion) {
      consola.success('You\'re already using the latest version of nuxt.')
    } else {
      consola.success('Successfully upgraded nuxt from', currentVersion, 'to', upgradedVersion)
      const commitA = nuxtVersionToGitIdentifier(currentVersion)
      const commitB = nuxtVersionToGitIdentifier(upgradedVersion)
      if (commitA && commitB) {
        consola.info('Changelog:', `https://github.com/nuxt/nuxt/compare/${commitA}...${commitB}`)
      }
    }
  }
})
