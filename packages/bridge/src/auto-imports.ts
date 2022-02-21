import { installModule, useNuxt } from '@nuxt/kit'
import * as CompositionApi from '@vue/composition-api'
import autoImports from '../../nuxt3/src/auto-imports/module'

const UnsupportedImports = new Set(['useAsyncData', 'useFetch'])
const CapiHelpers = new Set(Object.keys(CompositionApi))

const ImportRewrites = {
  vue: '@vue/composition-api'
}

export function setupAutoImports () {
  const nuxt = useNuxt()

  nuxt.hook('autoImports:extend', (autoImports) => {
    for (const autoImport of autoImports) {
      // Rewrite imports
      if (autoImport.from in ImportRewrites) {
        autoImport.from = ImportRewrites[autoImport.from]
      }
      // Disable unsupported imports
      if (UnsupportedImports.has(autoImport.name)) {
        autoImport.disabled = true
      }
      if (autoImport.from === '@vue/composition-api' && !CapiHelpers.has(autoImport.name)) {
        autoImport.disabled = true
      }
    }

    // Add bridge-only auto-imports
    autoImports.push({ name: 'useNuxt2Meta', as: 'useNuxt2Meta', from: '#app' })
  })

  nuxt.hook('modules:done', () => installModule(autoImports))
}
