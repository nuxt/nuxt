import process from 'node:process'
import { x } from 'tinyexec'
import { detect, resolveCommand } from 'package-manager-detector'
import type { ResolvedCommand } from 'package-manager-detector'
import { resolveModulePath } from 'exsolve'
import { hasTTY, isCI, provider } from 'std-env'
import { useTerminal } from './terminal.ts'
import { tryUseNuxt } from './context.ts'
import { buildDiagnostics } from './diagnostics/build.ts'
import { configDiagnostics } from './diagnostics/config.ts'

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
  configDiagnostics.NUXT_B5010({ names: formattedNames, installCommand: await getAddDependencyCommand(missing, rootDir, { dev: true }) })

  if (isCI) {
    return Array.isArray(names) ? missing : false
  }

  const terminal = useTerminal()

  if (options.prompt === true || (options.prompt !== false && !isStackblitz)) {
    if (!hasTTY && !terminal.interactive) {
      return Array.isArray(names) ? missing : false
    }

    const shouldInstall = await terminal.prompt(`Do you want to install ${formattedNames}?`, {
      type: 'confirm',
      initial: true,
    })

    if (shouldInstall !== true) {
      return Array.isArray(names) ? missing : false
    }
  } else if (!isStackblitz) {
    // prompt: false should only auto-install on StackBlitz
    return Array.isArray(names) ? missing : false
  }

  const task = terminal.startTask(`Installing ${formattedNames}...`)
  try {
    await runCommand(await resolveAddCommand(missing, rootDir, { dev: true }), rootDir)
    task.stop(`Installed ${formattedNames}`)
    return true
  } catch (err) {
    task.stop(undefined, 'failure')
    buildDiagnostics.NUXT_B1004({ installCommand: await getAddDependencyCommand(missing, rootDir, { dev: true }), cause: err })
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

/**
 * Get the command a user should run to add dependencies to their project, using the
 * package manager detected from `cwd` (falling back to `npm`).
 *
 * @param names - One or more package names to install
 * @param cwd - Directory to detect the package manager from
 * @param options - Options for the install command
 * @param options.dev - Whether the command should install as a dev dependency
 */
export async function getAddDependencyCommand (names: string | string[], cwd: string, options: { dev?: boolean } = {}): Promise<string> {
  const { command, args } = await resolveAddCommand(names, cwd, options)
  return [command, ...args].join(' ')
}

async function resolveAddCommand (names: string | string[], cwd: string, options: { dev?: boolean }): Promise<ResolvedCommand> {
  const { agent } = await detect({ cwd }).catch(() => null) || { agent: 'npm' } as const
  const packages = Array.isArray(names) ? names : [names]
  const args = [
    ...options.dev ? ['-D'] : [],
    ...packages,
  ]
  return resolveCommand(agent, 'add', args, { ignoreWorkspaceRootCheck: true }) || { command: 'npm', args: ['i', ...args] }
}

async function runCommand ({ command, args }: ResolvedCommand, cwd: string): Promise<void> {
  if (command === 'pnpm') {
    // allow installs to proceed without prompting or failing on blocked build scripts
    args = [...args, '--config.confirm-modules-purge=false', '--config.strict-dep-builds=false']
  }
  const result = await x(command, args, { nodeOptions: { cwd, stdio: ['ignore', 'ignore', 'pipe'] } })
  if (result.exitCode !== 0) {
    throw new Error(`\`${command} ${args.join(' ')}\` exited with code ${result.exitCode}${result.stderr ? `\n${result.stderr.trim()}` : ''}`)
  }
}
