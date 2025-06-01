import { addDependency } from 'nypm'
import { resolvePackageJSON } from 'pkg-types'
import { useNuxt } from '@nuxt/kit'
import { isCI, provider } from 'std-env'
import { logger } from '../utils'

const isStackblitz = provider === 'stackblitz'

interface EnsurePackageInstalledOptions {
  rootDir: string
  searchPaths?: string[]
  prompt?: boolean
}

async function promptToInstall (name: string, installCommand: () => Promise<void>, options: EnsurePackageInstalledOptions) {
  for (const parent of options.searchPaths || []) {
    if (await resolvePackageJSON(name, { parent }).catch(() => null)) {
      return true
    }
  }

  logger.info(`Package ${name} is missing`)
  if (isCI) {
    return false
  }

  // In StackBlitz we install packages automatically by default
  if (options.prompt === true || (options.prompt !== false && !isStackblitz)) {
    const confirm = await logger.prompt(`Do you want to install ${name} package?`, {
      type: 'confirm',
      name: 'confirm',
      initial: true,
    })

    if (!confirm) {
      return false
    }
  }

  logger.info(`Installing ${name}...`)
  try {
    await installCommand()
    logger.success(`Installed ${name}`)
    return true
  } catch (err) {
    logger.error(err)
    return false
  }
}

// TODO: refactor to @nuxt/cli
const installPrompts = new Set<string>()
export function installNuxtModule (name: string, options?: EnsurePackageInstalledOptions) {
  if (installPrompts.has(name)) { return }
  installPrompts.add(name)
  const nuxt = useNuxt()
  return promptToInstall(name, async () => {
    const { runCommand } = await import('@nuxt/cli')
    await runCommand('module', ['add', name, '--cwd', nuxt.options.rootDir])
  }, { rootDir: nuxt.options.rootDir, searchPaths: nuxt.options.modulesDir, ...options })
}

export function ensurePackageInstalled (name: string, options: EnsurePackageInstalledOptions) {
  return promptToInstall(name, () => addDependency(name, {
    cwd: options.rootDir,
    dev: true,
  }), options)
}
