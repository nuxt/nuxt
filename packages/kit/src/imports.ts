import type { Import, InlinePreset } from 'unimport'
import { useNuxt } from './context'
import { toArray } from './utils'

export function addImports (imports: Import | Import[]) {
  useNuxt().hook('imports:extend', (_imports) => {
    _imports.push(...toArray(imports))
  })
}

export function addImportsDir (dirs: string | string[], opts: { prepend?: boolean } = {}) {
  useNuxt().hook('imports:dirs', (_dirs: string[]) => {
    for (const dir of toArray(dirs)) {
      _dirs[opts.prepend ? 'unshift' : 'push'](dir)
    }
  })
}
export function addImportsSources (presets: InlinePreset | InlinePreset[]) {
  useNuxt().hook('imports:sources', (_presets: InlinePreset[]) => {
    for (const preset of toArray(presets)) {
      _presets.push(preset)
    }
  })
}
