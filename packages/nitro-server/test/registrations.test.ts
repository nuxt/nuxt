import { describe, expect, it } from 'vitest'
import { addNitroPlugin, addServerHandler, runWithNuxtContext } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { NitroConfig } from 'nitro/types'

import { collectServerRegistrations, migratedPlugins, serverApiOf } from '../src/registrations.ts'

function createNuxt (options: Record<string, any> = {}) {
  return {
    options: {
      alias: { '#mod': '/modules/mod' },
      extensions: ['.ts'],
      rootDir: '/project',
      modulesDir: [],
      nitro: {},
      serverHandlers: [],
      devServerHandlers: [],
      _serverPlugins: [],
      _nitroMajor: 3,
      ...options,
    },
  } as unknown as Nuxt
}

describe('collectServerRegistrations', () => {
  it('gathers the variants this build does not use, from every registration', () => {
    const nuxt = createNuxt()
    runWithNuxtContext(nuxt, () => {
      addServerHandler({ route: '/a', handler: { nitro3: '/a.v3.ts', nitro2: '/a.v2.ts', nuxt: '/a.nuxt.ts' } })
      addNitroPlugin({ nitro3: '/plugin.v3.ts', nitro2: '/plugin.v2.ts' })
    })
    const nitroConfig: NitroConfig = { handlers: nuxt.options.serverHandlers as any }

    const unused = collectServerRegistrations(nuxt, nitroConfig)

    expect(unused.sort()).toEqual(['/a.nuxt.ts', '/a.v2.ts', '/plugin.v2.ts'])
    expect(serverApiOf(nitroConfig.handlers![0]!)).toBe('nitro3')
    expect(nitroConfig.plugins).toEqual(['/plugin.v3.ts'])
    expect([...migratedPlugins(nuxt)]).toEqual(['/plugin.v3.ts'])
  })

  it('resolves plugin aliases and registers a path once', () => {
    const nuxt = createNuxt({ _serverPlugins: [{ plugin: '#mod/plugin' }, { plugin: '#mod/plugin' }] })
    const nitroConfig: NitroConfig = {}

    expect(collectServerRegistrations(nuxt, nitroConfig)).toEqual([])
    expect(nitroConfig.plugins).toEqual(['/modules/mod/plugin'])
  })

  it('does not mark a nitro v2 plugin as migrated', () => {
    const nuxt = createNuxt({ _serverPlugins: [{ plugin: '/plugins/legacy.ts', compatibility: 'nitro2' }] })

    collectServerRegistrations(nuxt, {})

    expect([...migratedPlugins(nuxt)]).toEqual([])
  })

  it('tolerates a host with no `_serverPlugins`, where an older kit wrote to `nitro.plugins`', () => {
    const nuxt = createNuxt({ _serverPlugins: undefined, nitro: { plugins: ['/plugins/legacy.ts'] } })
    const nitroConfig: NitroConfig = { plugins: ['/plugins/legacy.ts'] }

    expect(collectServerRegistrations(nuxt, nitroConfig)).toEqual([])
    expect(nitroConfig.plugins).toEqual(['/plugins/legacy.ts'])
  })
})
