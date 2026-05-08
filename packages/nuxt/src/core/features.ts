import { resolvePackageJSON } from 'pkg-types'
import { useNuxt } from '@nuxt/kit'
import { isCI, provider } from 'std-env'
import { logger } from '../utils.ts'

const installPrompts = new Set<string>()

export async function installNuxtModule (name: string, options?: { rootDir?: string, searchPaths?: string[], prompt?: boolean }) {
  if (installPrompts.has(name)) { return }
  installPrompts.add(name)

  const nuxt = useNuxt()
  const rootDir = options?.rootDir || nuxt.options.rootDir
  const searchPaths = options?.searchPaths || nuxt.options.modulesDir

  for (const parent of searchPaths) {
    if (await resolvePackageJSON(name, { parent }).catch(() => null)) {
      return true
    }
  }

  logger.info(`Package ${name} is missing`)

  if (isCI) {
    return false
  }

  if (options?.prompt === true || (options?.prompt !== false && provider !== 'stackblitz')) {
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
    const { runCommand } = await import('@nuxt/cli')
    await runCommand('module', ['add', name, '--cwd', rootDir])
    logger.success(`Installed ${name}`)
    return true
  } catch (err) {
    logger.error(err)
    return false
  }
}
