import { installModule, useNuxt } from '@nuxt/kit'
import * as CompositionApi from '@vue/composition-api'
import type { Preset } from 'unimport'
import autoImports from '../../nuxt3/src/auto-imports/module'
import { vuePreset, commonPresets, appPreset } from '../../nuxt3/src/auto-imports/presets'

const UnsupportedImports = new Set(['useAsyncData', 'useFetch', 'useError', 'throwError', 'clearError'])
const CapiHelpers = new Set(Object.keys(CompositionApi))

export function setupAutoImports () {
  const nuxt = useNuxt()

  const bridgePresets: Preset[] = [
    ...commonPresets,
    {
      from: '#app',
      imports: [
        ...appPreset.imports.filter(i => !UnsupportedImports.has(i as string)),
        'useNuxt2Meta'
      ]
    },
    {
      from: '@vue/composition-api',
      imports: vuePreset.imports.filter(i => CapiHelpers.has(i as string))
    }
  ]

  nuxt.hook('modules:done', () => installModule(autoImports, { presets: bridgePresets }))
}
