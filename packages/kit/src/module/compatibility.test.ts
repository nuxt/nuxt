import { describe, expect, it } from 'vitest'
import { loadNuxt } from '../loader/nuxt'
import { hasNuxtModuleCompatibility } from './compatibility'
import { defineNuxtModule } from './define'

describe('nuxt module compatibility', () => {
  it('detects module instance versions', async () => {
    const nuxt = loadNuxt({})
    const module = defineNuxtModule({
      meta: {
        name: 'nuxt-module-foo',
        version: '1.0.0'
      }
    })
    expect(await hasNuxtModuleCompatibility(module, '^1.0.0', nuxt)).toStrictEqual(true)
    expect(await hasNuxtModuleCompatibility(module, '^2.0.0', nuxt)).toStrictEqual(false)
  })
})
