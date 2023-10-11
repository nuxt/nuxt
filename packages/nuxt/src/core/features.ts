import { addDependency } from 'nypm'
import { resolvePackageJSON } from 'pkg-types'
import { logger } from '@nuxt/kit'
import { isCI, provider } from 'std-env'

const isStackblitz = provider === 'stackblitz'

export interface EnsurePackageInstalledOptions {
  rootDir: string
  searchPaths?: string[]
  prompt?: boolean
}

export async function ensurePackageInstalled (
  name: string,
  options: EnsurePackageInstalledOptions
) {
  const {
    rootDir,
    searchPaths,
    // In StackBlitz we install packages automatically by default
    prompt = !isStackblitz
  } = options

  if (await resolvePackageJSON(name, { url: searchPaths }).catch(() => null)) {
    return true
  }

  logger.info(`Package ${name} is missing`)
  if (isCI) {
    return false
  }

  if (!prompt) {
    const confirm = await logger.prompt(`Do you want to install ${name} package?`, {
      type: 'confirm',
      name: 'confirm',
      initial: true
    })

    if (!confirm) {
      return false
    }
  }

  logger.info(`Installing ${name}...`)
  try {
    await addDependency(name, {
      cwd: rootDir,
      dev: true
    })
    logger.success(`Installed ${name}`)
    return true
  } catch (err) {
    logger.error(err)
    return false
  }
}
