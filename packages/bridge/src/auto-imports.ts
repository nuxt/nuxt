import { installModule, useNuxt } from '@nuxt/kit'
import * as CompositionApi from '@vue/composition-api'
import type { Preset } from 'unimport'
import autoImports from '../../nuxt3/src/auto-imports/module'
import { vuePreset } from '../../nuxt3/src/auto-imports/presets'

const UnsupportedImports = new Set(['useAsyncData', 'useFetch', 'useError', 'throwError', 'clearError', 'defineNuxtLink'])
const CapiHelpers = new Set(Object.keys(CompositionApi))

export function setupAutoImports () {
  const nuxt = useNuxt()

  const bridgePresets: Preset[] = [
    {
      from: '@vue/composition-api',
      imports: vuePreset.imports.filter(i => CapiHelpers.has(i as string))
    },
    {
      from: '#app',
      imports: ['useNuxt2Meta']
    }
  ]
  nuxt.hook('autoImports:sources', (presets) => {
    const vuePreset = presets.find(p => p.from === 'vue')
    if (vuePreset) { vuePreset.disabled = true }
  })

  nuxt.hook('autoImports:extend', (imports) => {
    for (const i of imports) {
      if (i.from === '#app' && UnsupportedImports.has(i.name)) {
        i.disabled = true
      }
    }
  })

  nuxt.hook('modules:done', () => installModule(autoImports, { presets: bridgePresets }))
}
