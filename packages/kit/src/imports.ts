import { type Import } from 'unimport'
import { type ImportPresetWithDeprecation } from '@nuxt/schema'
import { useNuxt } from './context'
import { assertNuxtCompatibility } from './compatibility'
import { toArray } from './utils'

/**
 * Add imports to the Nuxt application. It makes your imports available in the Nuxt application without the need to import them manually.
 * @param imports - An object or an array of objects with the {@link https://nuxt.com/docs/api/kit/autoimports#imports following properties}.
 * @see {@link https://nuxt.com/docs/api/kit/autoimports#addimports documentation}
 */
export async function addImports (imports: Import | Import[]) {
  await assertNuxtCompatibility({ bridge: true })

  useNuxt().hook('imports:extend', (_imports) => {
    _imports.push(...toArray(imports))
  })
}

/**
 * Add imports from a directory to the Nuxt application. It will automatically import all files from the directory and make them available in the Nuxt application without the need to import them manually.
 * @param directories - A string or an array of strings with the path to the directory to import from.
 * @param options - Options to pass to the import.
 * @param options.prepend - If set to `true`, the imports will be prepended to the list of imports.
 * @see {@link https://nuxt.com/docs/api/kit/autoimports#addimportsdir documentation}
 */
export async function addImportsDir (
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

/**
 * Add listed imports to the Nuxt application.
 * @param presets - An object or an array of objects with the {@link https://nuxt.com/docs/api/kit/autoimports#importsources following properties}.
 * @see {@link https://nuxt.com/docs/api/kit/autoimports#addimportssources documentation}
 */
export async function addImportsSources (
  presets: ImportPresetWithDeprecation | ImportPresetWithDeprecation[]
) {
  await assertNuxtCompatibility({ bridge: true })

  useNuxt().hook('imports:sources', (_presets: ImportPresetWithDeprecation[]) => {
    for (const preset of toArray(presets)) {
      _presets.push(preset)
    }
  })
}
