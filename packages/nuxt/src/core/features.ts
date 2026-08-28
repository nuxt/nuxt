import { resolvePackageJSON } from 'pkg-types'
import { getAddDependencyCommand, useNuxt, useTerminal } from '@nuxt/kit'
import { buildDiagnostics, configDiagnostics } from '@nuxt/kit/internal'
import { isCI, provider } from 'std-env'

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

  configDiagnostics.NUXT_B5011({ name })

  if (isCI) {
    return false
  }

  const terminal = useTerminal()

  if (options?.prompt === true || (options?.prompt !== false && provider !== 'stackblitz')) {
    const confirm = await terminal.prompt(`Do you want to install ${name} package?`, {
      type: 'confirm',
      name: 'confirm',
      initial: true,
    })

    if (confirm !== true) {
      return false
    }
  }

  const task = terminal.startTask(`Installing ${name}...`)
  try {
    const { runCommand } = await import('@nuxt/cli')
    await runCommand('module', ['add', name, '--cwd', rootDir])
    task.stop(`Installed ${name}`)
    return true
  } catch (err) {
    task.stop(undefined, 'failure')
    buildDiagnostics.NUXT_B1004({ installCommand: await getAddDependencyCommand(name, rootDir), cause: err })
    return false
  }
}
