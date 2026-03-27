import { resolvePackageJSON } from 'pkg-types'
import { ErrorCodes, buildErrorUtils, useNuxt } from '@nuxt/kit'
import { isAgent, isCI, provider } from 'std-env'
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

  buildErrorUtils.warn(`Package \`${name}\` is missing.`, { code: ErrorCodes.B5011, fix: `Run \`npx nuxt add ${name}\` to install it.` })

  if (isCI) {
    return false
  }

  // When running inside an AI coding agent, skip the interactive prompt
  // but log the exact command needed so the agent can act on it.
  if (isAgent) {
    buildErrorUtils.warn(`Package \`${name}\` is required but not installed.`, { code: ErrorCodes.B5012, fix: `Run \`npx nuxt add ${name}\` to install it.` })
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

  logger.info(`Installing \`${name}\`...`)
  try {
    const { runCommand } = await import('@nuxt/cli')
    await runCommand('module', ['add', name, '--cwd', rootDir])
    logger.success(`Installed \`${name}\`.`)
    return true
  } catch (err) {
    buildErrorUtils.error(`Failed to install \`${name}\`.`, {
      code: ErrorCodes.B1004,
      fix: `Try installing manually with \`npm install ${name}\`.`,
      context: {
        rootDir: options?.rootDir,
        searchPaths: options?.searchPaths,
      },
      cause: err,
    })
    return false
  }
}
