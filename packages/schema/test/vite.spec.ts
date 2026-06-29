import { describe, expect, it, vi } from 'vitest'
import { applyDefaults } from 'untyped'

import { NuxtConfigSchema } from '../src/index.ts'
import type { NuxtOptions } from '../src/index.ts'

vi.mock('node:fs', () => ({
  existsSync: (id: string) => id.endsWith('app'),
}))

describe('vite.vueJsx defaults', () => {
  it('enables HMR for defineNuxtComponent in TSX files', async () => {
    const result = await applyDefaults(NuxtConfigSchema, {})

    expect((result as unknown as NuxtOptions).vite.vueJsx?.defineComponentName).toEqual([
      'defineComponent',
      'defineNuxtComponent',
    ])
  })

  it('respects a user-defined component name list', async () => {
    const result = await applyDefaults(NuxtConfigSchema, {
      vite: {
        vueJsx: {
          defineComponentName: ['defineCustomComponent'],
        },
      },
    })

    expect((result as unknown as NuxtOptions).vite.vueJsx?.defineComponentName).toEqual([
      'defineCustomComponent',
    ])
  })
})
