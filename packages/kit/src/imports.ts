import type { Import } from 'unimport'
import type { ImportPresetWithDeprecation } from '@nuxt/schema'
import { useNuxt } from './context'
import { assertNuxtCompatibility } from './compatibility'

export function addImports (imports: Import | Import[]) {
  assertNuxtCompatibility({ bridge: true })

  useNuxt().hook('imports:extend', (_imports) => {
    _imports.push(...(Array.isArray(imports) ? imports : [imports]))
  })
}

export function addImportsDir (dirs: string | string[], opts: { prepend?: boolean } = {}) {
  assertNuxtCompatibility({ bridge: true })

  useNuxt().hook('imports:dirs', (_dirs: string[]) => {
    for (const dir of (Array.isArray(dirs) ? dirs : [dirs])) {
      _dirs[opts.prepend ? 'unshift' : 'push'](dir)
    }
  })
}
export function addImportsSources (presets: ImportPresetWithDeprecation | ImportPresetWithDeprecation[]) {
  assertNuxtCompatibility({ bridge: true })

  useNuxt().hook('imports:sources', (_presets: ImportPresetWithDeprecation[]) => {
    for (const preset of (Array.isArray(presets) ? presets : [presets])) {
      _presets.push(preset)
    }
  })
}
