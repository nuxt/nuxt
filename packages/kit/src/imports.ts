import { type Import } from 'unimport'
import { type ImportPresetWithDeprecation } from '@nuxt/schema'
import { useNuxt } from './context'
import { assertNuxtCompatibility } from './compatibility'
import { toArray } from './utils'

export async function addImports(imports: Import | Import[]) {
  await assertNuxtCompatibility({ bridge: true })

  useNuxt().hook('imports:extend', (_imports) => {
    _imports.push(...toArray(imports))
  })
}

export async function addImportsDir(
  directories: string | string[],
  options: { prepend?: boolean } = {}
) {
  await assertNuxtCompatibility({ bridge: true })

  useNuxt().hook('imports:dirs', (_directories: string[]) => {
    for (const directory of toArray(directories)) {
      _directories[options.prepend ? 'unshift' : 'push'](directory)
    }
  })
}

export async function addImportsSources(
  presets: ImportPresetWithDeprecation | ImportPresetWithDeprecation[]
) {
  await assertNuxtCompatibility({ bridge: true })

  useNuxt().hook('imports:sources', (_presets: ImportPresetWithDeprecation[]) => {
    for (const preset of toArray(presets)) {
      _presets.push(preset)
    }
  })
}
