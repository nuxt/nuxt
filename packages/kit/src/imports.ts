import type { Import, InlinePreset } from 'unimport'
import { useNuxt } from './context.ts'
import { toArray } from './utils.ts'

export function addImports (imports: Import | Import[]): void {
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
export function addImportsSources (presets: InlinePreset | InlinePreset[]): void {
  useNuxt().hook('imports:sources', (_presets: InlinePreset[]) => {
    for (const preset of toArray(presets)) {
      _presets.push(preset)
    }
  })
}
