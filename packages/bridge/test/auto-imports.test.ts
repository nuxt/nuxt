import * as CompositionApi from '@vue/composition-api'
import { expect } from 'chai'

import { Nuxt3AutoImports } from '../../nuxt3/src/auto-imports/imports'

const excludedVueHelpers = [
  'EffectScope',
  'createApp',
  'createRef',
  'default',
  'del',
  'isRaw',
  'set',
  'useCSSModule',
  'version',
  'warn',
  'watchPostEffect',
  'watchSyncEffect'
]

describe('auto-imports:vue', () => {
  for (const name of Object.keys(CompositionApi)) {
    if (excludedVueHelpers.includes(name)) {
      continue
    }
    it(`should register ${name} globally`, () => {
      expect(Nuxt3AutoImports.find(a => a.from === 'vue').names).to.include(name)
    })
  }
})
