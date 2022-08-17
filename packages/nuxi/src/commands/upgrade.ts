import { execSync } from 'node:child_process'
import consola from 'consola'
import { resolve } from 'pathe'
import { readPackageJSON } from 'pkg-types'
import { getPackageManager, packageManagerLocks } from '../utils/packageManagers'
import { rmRecursive, touchFile } from '../utils/fs'
import { cleanupNuxtDirs } from '../utils/nuxt'
import { defineNuxtCommand } from './index'

async function getNuxtVersion (path: string): Promise<string|null> {
  try {
    const pkg = await readPackageJSON('nuxt', { url: path })
    if (!pkg.version) {
      consola.warn('Cannot find any installed nuxt versions in ', path)
    }
    return pkg.version || null
  } catch {
    return null
  }
}

export default defineNuxtCommand({
  meta: {
    name: 'upgrade',
    usage: 'npx nuxi upgrade [--force|-f]',
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

    // Check currently installed nuxt version
    const currentVersion = await getNuxtVersion(rootDir) || '[unknown]'
    consola.info('Current nuxt version:', currentVersion)

    // Force install
    if (args.force || args.f) {
      consola.info('Removing lock-file and node_modules...')
      const pmLockFile = resolve(rootDir, packageManagerLocks[packageManager])
      await rmRecursive([pmLockFile, resolve(rootDir, 'node_modules')])
      await touchFile(pmLockFile)
    }

    // Install latest rc
    consola.info('Installing latest Nuxt 3 RC...')
    execSync(`${packageManager} ${packageManager === 'yarn' ? 'add' : 'install'} -D nuxt@rc`, { stdio: 'inherit', cwd: rootDir })

    // Cleanup after upgrade
    await cleanupNuxtDirs(rootDir)

    // Check installed nuxt version again
    const upgradedVersion = await getNuxtVersion(rootDir) || '[unknown]'
    consola.info('Upgraded nuxt version:', upgradedVersion)

    if (upgradedVersion === currentVersion) {
      consola.success('You\'re already using the latest version of nuxt.')
    } else {
      consola.success('Successfully upgraded nuxt from', currentVersion, 'to', upgradedVersion)
      const commitA = currentVersion.split('.').pop()
      const commitB = upgradedVersion.split('.').pop()
      if (commitA && commitB) {
        consola.info('Changelog:', `https://github.com/nuxt/framework/compare/${commitA}...${commitB}`)
      }
    }
  }
})
