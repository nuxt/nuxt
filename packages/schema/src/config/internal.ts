import { readFile } from 'node:fs/promises'
import { join } from 'pathe'

import { defineResolvers } from '../utils/definition.ts'

/** The nitro majors a `package.json` declares a dependency on. */
async function readDeclaredNitroMajors (dir: string): Promise<{ nitro: boolean, nitropack: boolean }> {
  const pkg = await readFile(join(dir, 'package.json'), 'utf8').then(contents => JSON.parse(contents) as Record<string, Record<string, string> | undefined>).catch(() => undefined)
  const declares = (name: string) => !!(pkg?.dependencies?.[name] || pkg?.devDependencies?.[name])
  return { nitro: declares('nitro'), nitropack: declares('nitropack') }
}

/**
 * The nitro major a project builds with: `nitro` when the project declares it, or when the
 * workspace root declares it and not `nitropack`.
 */
async function detectNitroMajor (rootDir: string, workspaceDir: string): Promise<2 | 3 | undefined> {
  const project = await readDeclaredNitroMajors(rootDir)
  if (project.nitro) { return 3 }
  if (project.nitropack) { return 2 }
  if (workspaceDir === rootDir) { return }
  const workspace = await readDeclaredNitroMajors(workspaceDir)
  if (workspace.nitro !== workspace.nitropack) {
    return workspace.nitro ? 3 : 2
  }
}

export default defineResolvers({
  _majorVersion: 4,
  _nitroMajor: {
    $resolve: async (val, get) => {
      if (val === 2 || val === 3) {
        return val
      }
      return await detectNitroMajor(await get('rootDir'), await get('workspaceDir')) ?? 2
    },
  },
  _legacyGenerate: false,
  _start: false,
  _build: false,
  _generate: false,
  _prepare: false,
  _cli: false,
  _requiredModules: {},
  _loadOptions: undefined,
  _nuxtConfigFile: undefined,
  _nuxtConfigFiles: [],
  appDir: '',
  _installedModules: [],
  _modules: [],
  _noScriptsPageSources: [],
  _spaOnlyPageSources: [],
})
