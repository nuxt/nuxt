import { resolvePackageJSON } from 'pkg-types'
import { getAddDependencyCommand, useNuxt, useTerminal } from '@nuxt/kit'
import { buildDiagnostics, configDiagnostics } from '@nuxt/kit/internal'
import { isCI, provider } from 'std-env'

const installPrompts = new Set<string>()

/**
 * Offer to install a module that is used but missing, once per process.
 */
export async function installNuxtModule (name: string) {
  if (installPrompts.has(name)) { return }
  installPrompts.add(name)

  const nuxt = useNuxt()
  const rootDir = nuxt.options.rootDir

  for (const parent of nuxt.options.modulesDir) {
    if (await resolvePackageJSON(name, { parent }).catch(() => null)) {
      return true
    }
  }

  configDiagnostics.NUXT_B5011({ name })

  if (isCI) {
    return false
  }

  const terminal = useTerminal()

  if (provider !== 'stackblitz') {
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
