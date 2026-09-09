import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import type { NitroConfig } from 'nitropack'

import { collectServerRegistrations } from '../src/registrations.ts'

function createNuxt (serverPlugins?: Array<{ plugin: string }>) {
  return {
    options: {
      alias: { '#mod': '/modules/mod' },
      _serverPlugins: serverPlugins,
    },
  } as unknown as Nuxt
}

describe('collectServerRegistrations', () => {
  it('resolves plugin aliases and registers a path once', () => {
    const nuxt = createNuxt([{ plugin: '#mod/plugin' }, { plugin: '#mod/plugin' }])
    const nitroConfig: NitroConfig = {}

    collectServerRegistrations(nuxt, nitroConfig)

    expect(nitroConfig.plugins).toEqual(['/modules/mod/plugin'])
  })

  it('tolerates a host with no `_serverPlugins`, where an older kit wrote to `nitro.plugins`', () => {
    const nitroConfig: NitroConfig = { plugins: ['/plugins/legacy.ts'] }

    collectServerRegistrations(createNuxt(undefined), nitroConfig)
    expect(nitroConfig.plugins).toEqual(['/plugins/legacy.ts'])

    collectServerRegistrations(createNuxt([{ plugin: '/plugins/legacy.ts' }]), nitroConfig)
    expect(nitroConfig.plugins).toEqual(['/plugins/legacy.ts'])
  })
})
