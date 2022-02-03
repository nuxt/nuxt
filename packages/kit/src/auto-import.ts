import type { AutoImport } from '../../schema/src/types/imports'
import { useNuxt } from './context'
import { assertNuxtCompatibility } from './compatibility'

export function addAutoImport (_autoImports: AutoImport | AutoImport[]) {
  assertNuxtCompatibility({ bridge: true })

  useNuxt().hook('autoImports:extend', (autoImports: AutoImport[]) => {
    for (const composable of (Array.isArray(_autoImports) ? _autoImports : [_autoImports])) {
      autoImports.push(composable)
    }
  })
}

export function addAutoImportDir (_autoImportDirs: string | string[]) {
  assertNuxtCompatibility({ bridge: true })

  useNuxt().hook('autoImports:dirs', (autoImportDirs: string[]) => {
    for (const dir of (Array.isArray(_autoImportDirs) ? _autoImportDirs : [_autoImportDirs])) {
      autoImportDirs.push(dir)
    }
  })
}
