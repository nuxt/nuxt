import { Import } from 'unimport'
import { useNuxt } from './context'
import { assertNuxtCompatibility } from './compatibility'

export function addAutoImport (imports: Import | Import[]) {
  assertNuxtCompatibility({ bridge: true })

  useNuxt().hook('imports:extend', (_imports) => {
    _imports.push(...(Array.isArray(imports) ? imports : [imports]))
  })
}

export function addAutoImportDir (dirs: string | string[]) {
  assertNuxtCompatibility({ bridge: true })

  useNuxt().hook('imports:dirs', (_dirs: string[]) => {
    for (const dir of (Array.isArray(dirs) ? dirs : [dirs])) {
      _dirs.push(dir)
    }
  })
}
