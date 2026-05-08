import process from 'node:process'
import { addDependency } from 'nypm'
import { resolveModulePath } from 'exsolve'
import { hasTTY, isCI, provider } from 'std-env'
import { logger } from './logger.ts'
import { tryUseNuxt } from './context.ts'

const isStackblitz = provider === 'stackblitz'

export interface EnsureDependencyInstalledOptions {
  rootDir?: string
  searchPaths?: string[]
  /**
   * Additional URL or path to resolve packages from (e.g. `import.meta.url`).
   * Useful when the calling package ships optional deps as peer dependencies.
   */
  from?: string
  /**
   * Whether to prompt the user to install the dependency.
   *
   * - `true`: always prompt
   * - `false`: never prompt (install automatically on StackBlitz)
   * - `undefined`: prompt unless on StackBlitz
   */
  prompt?: boolean
}

/**
 * Ensure one or more dependencies are installed, prompting the user to install any that are missing.
 *
 * When called with a single package name (string), returns `true` if available, `false` if not.
 *
 * When called with an array, returns `true` if all are available, or an array of
 * package names that are still missing (user declined, install failed, or CI).
 *
 * @param names - One or more package names to check and potentially install
 * @param options - Configuration options
 */
export async function ensureDependencyInstalled (names: string, options?: EnsureDependencyInstalledOptions): Promise<boolean>
export async function ensureDependencyInstalled (names: string[], options?: EnsureDependencyInstalledOptions): Promise<true | string[]>
export async function ensureDependencyInstalled (names: string | string[], options: EnsureDependencyInstalledOptions = {}): Promise<boolean | string[]> {
  const packages = Array.isArray(names) ? names : [names]
  const nuxt = tryUseNuxt()
  const rootDir = options.rootDir || nuxt?.options.rootDir || process.cwd()
  const searchPaths = options.searchPaths || nuxt?.options.modulesDir || []

  const missing = findMissing(packages, [rootDir, ...options.from ? [options.from] : [], ...searchPaths])

  if (missing.length === 0) {
    return true
  }

  const formattedNames = missing.map(n => `\`${n}\``).join(', ')
  logger.info(`Missing ${missing.length === 1 ? 'package' : 'packages'}: ${formattedNames}`)

  if (isCI) {
    return Array.isArray(names) ? missing : false
  }

  if (options.prompt === true || (options.prompt !== false && !isStackblitz)) {
    if (!hasTTY) {
      return Array.isArray(names) ? missing : false
    }

    const shouldInstall = await logger.prompt(`Do you want to install ${formattedNames}?`, {
      type: 'confirm',
      initial: true,
    })

    if (!shouldInstall) {
      return Array.isArray(names) ? missing : false
    }
  } else if (!isStackblitz) {
    // prompt: false should only auto-install on StackBlitz
    return Array.isArray(names) ? missing : false
  }

  logger.start(`Installing ${formattedNames}...`)
  try {
    await addDependency(missing, {
      dev: true,
      cwd: rootDir,
      silent: true,
    })
    logger.success(`Installed ${formattedNames}`)
    return true
  } catch (err) {
    logger.error(err)
    return Array.isArray(names) ? missing : false
  }
}

function findMissing (packages: string[], searchPaths: string[]): string[] {
  const missing: string[] = []
  for (const name of packages) {
    if (isResolvable(name, searchPaths)) {
      continue
    }
    missing.push(name)
  }
  return missing
}

function isResolvable (name: string, searchPaths: string[]): boolean {
  for (const from of searchPaths) {
    if (resolveModulePath(name, { from, try: true })) {
      return true
    }
  }
  return false
}
