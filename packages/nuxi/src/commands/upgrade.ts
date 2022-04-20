import { execSync } from 'node:child_process'
import { promises as fsp, existsSync } from 'node:fs'
import consola from 'consola'
import { resolve } from 'pathe'
import { resolveModule } from '../utils/cjs'
import { getPackageManager, packageManagerLocks } from '../utils/packageManagers'
import { defineNuxtCommand } from './index'

async function getNuxtVersion (paths: string | string[]) {
  const pkgJson = resolveModule('nuxt/package.json', paths)
  const pkg = pkgJson && JSON.parse(await fsp.readFile(pkgJson, 'utf8'))
  if (!pkg.version) {
    consola.warn('Cannot find any installed nuxt versions in ', paths)
  }
  return pkg.version || '0.0.0'
}

export default defineNuxtCommand({
  meta: {
    name: 'upgrade',
    usage: 'npx nuxi upgrade [--force|-f]',
    description: 'Upgrade nuxt'
  },
  async invoke (args) {
    const rootDir = resolve(args._[0] || '.')

    const packageManager = getPackageManager(rootDir)
    if (!packageManager) {
      console.error('Cannot detect Package Manager in', rootDir)
      process.exit(1)
    }
    const packageManagerVersion = execSync(`${packageManager} --version`).toString('utf8').trim()
    consola.info('Package Manager:', packageManager, packageManagerVersion)

    const currentVersion = await getNuxtVersion(rootDir)
    consola.info('Current nuxt version:', currentVersion)

    if (args.force || args.f) {
      consola.info('Removing lock-file and node_modules...')
      await Promise.all([
        fsp.rm(packageManagerLocks[packageManager]),
        fsp.rm('node_modules', { recursive: true })
      ])
      execSync(`${packageManager} install`, { stdio: 'inherit' })
    } else {
      consola.info('Upgrading nuxt...')
      await Promise.all(['node_modules/.cache', resolve(rootDir, '.nuxt'), 'node_modules/.vite'].map((path) => {
        return existsSync(path) ? fsp.rm(path, { recursive: true }) : undefined
      }))
      execSync(`${packageManager} ${packageManager === 'yarn' ? 'add' : 'install'} -D nuxt@latest`, { stdio: 'inherit' })
    }

    const upgradedVersion = await getNuxtVersion(rootDir)
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
