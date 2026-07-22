import type { Import, Preset } from 'unimport'
import { useNuxt } from './context.ts'
import { addServerImports } from './nitro.ts'
import { toArray } from './utils.ts'

export function addImports (imports: Import | Import[]): void {
  useNuxt().hook('imports:extend', (_imports) => {
    _imports.push(...toArray(imports))
  })
}

/**
 * Add imports to be auto-imported in both the Nuxt (app) and Nitro (server) contexts,
 * which also makes them usable within the `shared/` directory.
 *
 * The import source should not rely on anything context-specific (such as the Nuxt app
 * or the Nitro context) as it will be used in both environments.
 */
export function addSharedImports (imports: Import | Import[]): void {
  const _imports = toArray(imports)
  addImports(_imports)
  addServerImports(_imports)
}

export function addImportsDir (dirs: string | string[], opts: { prepend?: boolean } = {}): void {
  useNuxt().hook('imports:dirs', (_dirs: string[]) => {
    for (const dir of toArray(dirs)) {
      _dirs[opts.prepend ? 'unshift' : 'push'](dir)
    }
  })
}
export function addImportsSources (presets: Preset | Preset[]): void {
  useNuxt().hook('imports:sources', (_presets: Preset[]) => {
    for (const preset of toArray(presets)) {
      _presets.push(preset)
    }
  })
}
