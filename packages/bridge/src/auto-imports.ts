import { installModule, useNuxt } from '@nuxt/kit'
import * as CompositionApi from '@vue/composition-api'
import type { Preset } from 'unimport'
import autoImports from '../../nuxt3/src/auto-imports/module'
import { vuePreset } from '../../nuxt3/src/auto-imports/presets'

const UnsupportedImports = new Set(['useAsyncData', 'useFetch', 'useError', 'throwError', 'clearError', 'defineNuxtLink', 'useActiveRoute'])
const CapiHelpers = new Set(Object.keys(CompositionApi))

export function setupAutoImports () {
  const nuxt = useNuxt()

  const bridgePresets: Preset[] = [{
    from: '@vue/composition-api',
    imports: vuePreset.imports.filter(i => CapiHelpers.has(i as string))
  }]

  nuxt.hook('autoImports:sources', (presets) => {
    const vuePreset = presets.find(p => p.from === 'vue')
    if (vuePreset) { vuePreset.disabled = true }

    const appPreset = presets.find(p => p.from === '#app')
    if (!appPreset) { return }

    for (const [index, i] of Object.entries(appPreset.imports).reverse()) {
      if (typeof i === 'string' && UnsupportedImports.has(i)) {
        appPreset.imports.splice(Number(index), 1)
      }
    }

    appPreset.imports.push('useNuxt2Meta')
  })

  nuxt.hook('modules:done', () => installModule(autoImports, { presets: bridgePresets }))
}
