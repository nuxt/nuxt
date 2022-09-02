import { Import } from 'unimport'
import { useNuxt } from './context'
import { assertNuxtCompatibility } from './compatibility'

export function addImports (imports: Import | Import[]) {
  assertNuxtCompatibility({ bridge: true })

  // TODO: Use imports:* when widely adopted
  useNuxt().hook('autoImports:extend', (_imports) => {
    _imports.push(...(Array.isArray(imports) ? imports : [imports]))
  }, { allowDeprecated: true })
}

/**
 * @deprecated Please use `addImports` instead with nuxt>=3.0.0-rc.9
 */
export const addAutoImport = addImports

export function addImportsDir (dirs: string | string[]) {
  assertNuxtCompatibility({ bridge: true })

  // TODO: Use imports:* when widely adopted
  useNuxt().hook('autoImports:dirs', (_dirs: string[]) => {
    for (const dir of (Array.isArray(dirs) ? dirs : [dirs])) {
      _dirs.push(dir)
    }
  }, { allowDeprecated: true })
}

/**
 * @deprecated Please use `addImportsDir` instead with nuxt>=3.0.0-rc.9
 */
export const addAutoImportDir = addImportsDir
