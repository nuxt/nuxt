import type { Import } from 'unimport'
import type { ImportPresetWithDeprecation } from '@nuxt/schema'
import { useNuxt } from './context'
import { assertNuxtCompatibility } from './compatibility'
import { toArray } from './utils'

export function addImports (imports: Import | Import[]) {
  assertNuxtCompatibility({ bridge: true })

  useNuxt().hook('imports:extend', (_imports) => {
    _imports.push(...toArray(imports))
  })
}

export function addImportsDir (dirs: string | string[], opts: { prepend?: boolean } = {}) {
  assertNuxtCompatibility({ bridge: true })

  useNuxt().hook('imports:dirs', (_dirs: string[]) => {
    for (const dir of toArray(dirs)) {
      _dirs[opts.prepend ? 'unshift' : 'push'](dir)
    }
  })
}
export function addImportsSources (presets: ImportPresetWithDeprecation | ImportPresetWithDeprecation[]) {
  assertNuxtCompatibility({ bridge: true })

  useNuxt().hook('imports:sources', (_presets: ImportPresetWithDeprecation[]) => {
    for (const preset of toArray(presets)) {
      _presets.push(preset)
    }
  })
}
