import { describe, expectTypeOf, it } from 'vitest'
import type * as UpstreamV2 from 'nitropack/types'
import type * as UpstreamV3 from 'nitro/types'
import type { DevServerHandler, ServerHandler, ServerHandlerInput } from '@nuxt/schema'

import { addDevServerHandler, addNitroPlugin, addServerHandler } from '../src/nitro.ts'

import type { NitroRouteConfig, NitroRouteConfigV2, NitroRouteConfigV3 } from '../src/nitro-types.ts'

type KnownKeys<T> = keyof { [K in keyof T as string extends K ? never : number extends K ? never : K]: 0 }

describe('`ServerHandler`', () => {
  it('is accepted by both nitro majors', () => {
    type Picked = ServerHandler & { route: string }
    expectTypeOf<Omit<Picked, 'method'>>().toExtend<Omit<UpstreamV3.NitroEventHandler, 'method'>>()
    expectTypeOf<Omit<Picked, 'format' | 'method'>>().toExtend<Omit<UpstreamV2.NitroEventHandler, 'method'>>()
    // both majors take the method uppercase, and Nuxt additionally accepts it lowercase
    expectTypeOf<UpstreamV3.NitroEventHandler['method']>().toExtend<ServerHandler['method']>()
    expectTypeOf<UpstreamV2.NitroEventHandler['method']>().toExtend<ServerHandler['method']>()
  })

  it('accepts what either nitro major accepts', () => {
    expectTypeOf<UpstreamV2.NitroEventHandler>().toExtend<ServerHandlerInput>()
    expectTypeOf<UpstreamV3.NitroEventHandler>().toExtend<ServerHandlerInput>()
  })

  it('declares no keys that are missing from both majors', () => {
    expectTypeOf<keyof ServerHandlerInput>().toExtend<keyof UpstreamV2.NitroEventHandler | keyof UpstreamV3.NitroEventHandler>()
    expectTypeOf<keyof DevServerHandler>().toExtend<keyof UpstreamV2.NitroDevEventHandler | keyof UpstreamV3.NitroDevEventHandler>()
  })
})

describe('inlined `NitroRouteConfig`', () => {
  // upstream keys may be a superset here because nuxt augments `nitro/types`
  // within this repo; extra upstream keys are absorbed by the index signature
  it('declares no keys that are missing upstream', () => {
    expectTypeOf<KnownKeys<NitroRouteConfigV2>>().toExtend<keyof UpstreamV2.NitroRouteConfig>()
    expectTypeOf<KnownKeys<NitroRouteConfigV3>>().toExtend<keyof UpstreamV3.RouteRuleConfig>()
  })

  it('does not accept a v3-only rule as nitro v2', () => {
    expectTypeOf<{ cors: { origin: string } }>().not.toExtend<NitroRouteConfigV2>()
    expectTypeOf<{ redirect: false }>().not.toExtend<NitroRouteConfigV2>()
    expectTypeOf<{ proxy: false }>().not.toExtend<NitroRouteConfigV2>()
  })

  it('accepts a rule that works on either nitro major', () => {
    expectTypeOf<{ prerender: true }>().toExtend<NitroRouteConfig>()
    expectTypeOf<{ redirect: { to: string, statusCode: number } }>().toExtend<NitroRouteConfig>()
    expectTypeOf<{ redirect: { to: string, status: number } }>().toExtend<NitroRouteConfig>()
    expectTypeOf<{ redirect: false }>().toExtend<NitroRouteConfig>()
    expectTypeOf<{ cors: { origin: string } }>().toExtend<NitroRouteConfig>()
    expectTypeOf<{ cors: true }>().toExtend<NitroRouteConfig>()
  })
})

describe('registrations', () => {
  // type-level only: nothing here runs, there is no nuxt context
  const typed = (fn: () => void) => () => expectTypeOf(fn).toBeFunction()

  it('take a path or one path per server API', typed(() => {
    addServerHandler({ route: '/a', handler: '/a.ts' })
    addServerHandler({ route: '/a', handler: { nuxt: '/a.ts' } })
    addServerHandler({ route: '/a', handler: { nuxt: '/a.ts', nitro2: '/a.v2.ts', nitro3: '/a.v3.ts' } })
    addNitroPlugin('/plugin.ts')
    addNitroPlugin({ nitro3: '/plugin.ts', nitro2: '/plugin.v2.ts' })
    addDevServerHandler({ route: '/a', handler: () => {} })
    addDevServerHandler({ route: '/a', handler: { nitro2: () => {}, nitro3: { fetch: () => new Response() } } })
  }))

  it('reject a variant key that is not a server API', typed(() => {
    // @ts-expect-error `nitro4` is not a server API
    addServerHandler({ route: '/a', handler: { nitro4: '/a.ts' } })
    // @ts-expect-error a startup plugin has no portable variant
    addNitroPlugin({ nuxt: '/plugin.ts' })
  }))

  it('accept a route-less middleware handler', typed(() => {
    addServerHandler({ handler: '/a.ts', middleware: true })
    addServerHandler({ route: '/a', handler: '/a.ts', format: 'node', method: 'QUERY' })
  }))
})
