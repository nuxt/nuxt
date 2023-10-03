import { addDependency } from 'nypm'
import { resolvePackageJSON } from 'pkg-types'
import { logger } from '@nuxt/kit'
import { isCI } from 'std-env'

export async function ensurePackageInstalled (rootDir: string, name: string, searchPaths?: string[]) {
  if (await resolvePackageJSON(name, { url: searchPaths }).catch(() => null)) {
    return true
  }

  logger.info(`Package ${name} is missing`)
  if (isCI) {
    return false
  }

  const confirm = await logger.prompt(`Do you want to install ${name} package?`, {
    type: 'confirm',
    name: 'confirm',
    initial: true
  })

  if (!confirm) {
    return false
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
