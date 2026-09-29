import type { NuxtImport, NuxtImportPresetSource } from '@nuxt/schema'
import { useNuxt } from './context.ts'
import { toArray } from './utils.ts'

export function addImports (imports: NuxtImport | NuxtImport[]): void {
  useNuxt().hook('imports:extend', (_imports) => {
    _imports.push(...toArray(imports))
  })
}

export function addImportsDir (dirs: string | string[], opts: { prepend?: boolean } = {}): void {
  useNuxt().hook('imports:dirs', (_dirs: string[]) => {
    for (const dir of toArray(dirs)) {
      _dirs[opts.prepend ? 'unshift' : 'push'](dir)
    }
  })
}
export function addImportsSources (presets: NuxtImportPresetSource | NuxtImportPresetSource[]): void {
  useNuxt().hook('imports:sources', (_presets) => {
    for (const preset of toArray(presets)) {
      _presets.push(preset)
    }
  })
}
