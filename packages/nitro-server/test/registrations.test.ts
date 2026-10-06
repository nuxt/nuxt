import { describe, expect, it } from 'vitest'
import { createApp, toWebHandler } from 'h3'
import type { EventHandler } from 'h3'
import { kServerApi } from '@nuxt/kit/internal'
import type { DevServerHandler, Nuxt, RequestEvent } from '@nuxt/schema'
import type { NitroConfig } from 'nitropack'

import { collectServerRegistrations, toPortableDevHandlers } from '../src/registrations.ts'

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

describe('toPortableDevHandlers', () => {
  it('gives a `nuxt` dev handler a `RequestEvent` with the full request URL', async () => {
    const entry: DevServerHandler = {
      route: '/_greet',
      handler: (event: RequestEvent) => {
        event.res.headers.set('x-greeting', 'hello')
        return { request: event.req instanceof Request, path: event.url.pathname, name: event.url.searchParams.get('name') }
      },
    }
    Object.defineProperty(entry, kServerApi, { value: 'nuxt' })

    const [portable] = toPortableDevHandlers([entry])
    const app = createApp().use(portable!.route!, portable!.handler as EventHandler)
    const response = await toWebHandler(app)(new Request('http://localhost/_greet/world?name=nuxt'))

    expect(response.headers.get('x-greeting')).toBe('hello')
    expect(await response.json()).toEqual({ request: true, path: '/_greet/world', name: 'nuxt' })
  })
})
