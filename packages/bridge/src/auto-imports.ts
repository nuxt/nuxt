import { installModule, useNuxt } from '@nuxt/kit'
import autoImports from '../../nuxt3/src/auto-imports/module'

const UnsupportedImports = new Set(['useAsyncData', 'useFetch'])

const ImportRewrites = {
  vue: '@vue/composition-api',
  'vue-router': '#app'
}

export async function setupAutoImports () {
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
    }
  })

  await installModule(nuxt, autoImports)
}
