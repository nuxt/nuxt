import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'

import { updateAppConfig } from '../src/app-config.ts'
import { runWithNuxtContext } from '../src/context.ts'

describe('updateAppConfig', () => {
  it('merges into the app config deeply and in place, overriding existing values', () => {
    const appConfig = { existing: 'original', keepThis: 'value', nested: { key: 'original' } }
    const nuxt = { options: { appConfig } } as unknown as Nuxt

    runWithNuxtContext(nuxt, () => updateAppConfig({ existing: 'updated', newKey: 'newValue', nested: { anotherKey: 'new' } }))

    expect(nuxt.options.appConfig).toBe(appConfig)
    expect(appConfig).toEqual({
      existing: 'updated',
      keepThis: 'value',
      newKey: 'newValue',
      nested: { key: 'original', anotherKey: 'new' },
    })
  })
})
