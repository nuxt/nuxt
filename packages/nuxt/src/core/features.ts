import { addDependency } from 'nypm'
import { isPackageExists } from 'local-pkg'
import { logger } from '@nuxt/kit'
import prompts from 'prompts'

export async function ensurePackageInstalled (rootDir: string, name: string, searchPaths?: string[]) {
  if (isPackageExists(name, { paths: searchPaths })) {
    return true
  }

  logger.info(`Package ${name} is missing`)

  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: `Do you want to install ${name} package?`,
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
