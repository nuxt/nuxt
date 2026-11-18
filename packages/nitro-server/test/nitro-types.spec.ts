import { describe, expectTypeOf, it } from 'vitest'
import type { NitroInstance, NitroInstanceOptions } from '@nuxt/kit'
import type { NuxtConfig, NuxtHooks, NuxtOptions, NuxtPage, NuxtRequestEvent, RouteRuleConfig as SchemaRouteRuleConfig, TSReference } from '@nuxt/schema'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Nitro, NitroConfig, NitroOptions, NitroRuntimeConfig, NitroRuntimeHooks, RouteRuleConfig, TracingChannelOptions } from 'nitro/types'
import type { EventHandler, EventHandlerRequest, EventHandlerWithFetch, H3Event } from 'nitro/h3'
import type { defineCachedHandler } from 'nitro/cache'
import type { $Fetch } from 'ofetch'
import type { NuxtSSRContext } from '#app/types'

import type { NuxtRouteRuleConfig } from '../src/augments.ts'
import type { defineEventHandler } from '../src/runtime/compat/h3-v1.ts'
import type {} from '../src/runtime/compat/nitro-v2-types.ts'
import type { useRuntimeConfig } from '../src/runtime/compat/runtime-config.ts'
import type { defineCachedEventHandler } from '../src/runtime/compat/cache.ts'
import type { ResponseBodyOf } from '../src/request-types.ts'

declare const cacheV2: typeof defineCachedEventHandler
declare const cacheV3: typeof defineCachedHandler

describe('contributed nitro instance types', () => {
  it('resolves `NitroInstance` to the instance this builder constructs', () => {
    expectTypeOf<NitroInstance>().toEqualTypeOf<Nitro>()
    expectTypeOf<NitroInstanceOptions>().toEqualTypeOf<NitroOptions>()
  })

  it('exposes options that modules read off the instance', () => {
    expectTypeOf<NitroInstanceOptions['dev']>().toEqualTypeOf<boolean>()
    expectTypeOf<NitroInstanceOptions['_config']>().toEqualTypeOf<NitroOptions['_config']>()
    expectTypeOf<NitroInstanceOptions['handlers']>().toEqualTypeOf<NitroOptions['handlers']>()
  })
})

describe('contributed request event type', () => {
  it('resolves `NuxtRequestEvent` to the event this builder hands to the app layer', () => {
    expectTypeOf<NuxtRequestEvent>().toEqualTypeOf<H3Event>()
    expectTypeOf<NuxtSSRContext['event']>().toEqualTypeOf<H3Event>()
  })
})

describe('contributed configuration types', () => {
  it('resolves the config keys Nuxt declares to this builder\'s own types', () => {
    expectTypeOf<NuxtOptions['nitro']>().toExtend<NitroConfig>()
    expectTypeOf<NonNullable<NuxtConfig['nitro']>>().toExtend<NitroConfig>()
    expectTypeOf<NuxtOptions['nitro']['preset']>().toEqualTypeOf<NitroConfig['preset']>()
    expectTypeOf<NonNullable<NuxtOptions['nitro']['prerender']>['concurrency']>().toEqualTypeOf<NonNullable<NitroConfig['prerender']>['concurrency']>()
    expectTypeOf<NuxtOptions['routeRules']>().toEqualTypeOf<Record<string, RouteRuleConfig> | undefined>()
    expectTypeOf<NuxtOptions['tracingChannel']>().toEqualTypeOf<boolean | ({ nuxt?: boolean } & TracingChannelOptions)>()
  })

  it('resolves the route rules a page may declare', () => {
    expectTypeOf<NuxtPage['rules']>().toEqualTypeOf<RouteRuleConfig | undefined>()
  })

  it('accepts the Nitro v2 redirect status only on a Nuxt 4 host', () => {
    const rule = <Host>(config: NuxtRouteRuleConfig<Host>) => config

    expectTypeOf(rule<{ nuxt4: true }>({ redirect: { to: '/new', statusCode: 302 } })).toExtend<RouteRuleConfig>()
    // @ts-expect-error Nitro v3 reads `redirect.status`
    rule<Record<never, never>>({ redirect: { to: '/new', statusCode: 302 } })
    expectTypeOf<Omit<NuxtRouteRuleConfig<{ nuxt4: true }>, 'redirect'>>().toEqualTypeOf<Omit<RouteRuleConfig, 'redirect'>>()
    expectTypeOf<NuxtRouteRuleConfig<Record<never, never>>>().toEqualTypeOf<RouteRuleConfig>()
    expectTypeOf<SchemaRouteRuleConfig>().toEqualTypeOf<NuxtRouteRuleConfig>()
  })
})

declare module '@nuxt/schema' {
  interface RouteRuleConfigExtensions {
    appLayout?: 'generated' | false
  }
}

describe('route rules Nuxt generates types for', () => {
  it('are configurable through the rules Nuxt resolves', () => {
    expectTypeOf<SchemaRouteRuleConfig['appLayout']>().toEqualTypeOf<'generated' | false | undefined>()
  })

  it('are configurable through the rules this builder resolves', () => {
    expectTypeOf<RouteRuleConfig['appLayout']>().toEqualTypeOf<'generated' | false | undefined>()
  })
})

describe('contributed hook signatures', () => {
  it('hands the builder\'s own config and instance to its hooks', () => {
    expectTypeOf<Parameters<NuxtHooks['nitro:config']>[0]>().toEqualTypeOf<NitroConfig>()
    expectTypeOf<Parameters<NuxtHooks['nitro:init']>[0]>().toEqualTypeOf<Nitro>()
    expectTypeOf<Parameters<NuxtHooks['nitro:build:before']>[0]>().toEqualTypeOf<Nitro>()
    expectTypeOf<Parameters<NuxtHooks['nitro:build:public-assets']>[0]>().toEqualTypeOf<Nitro>()
    expectTypeOf<Parameters<NuxtHooks['nitro:prepare:types']>[0]>().toEqualTypeOf<{ references: TSReference[], declarations: string[] }>()
    expectTypeOf<Parameters<NuxtHooks['server:devHandler']>[0]>().toEqualTypeOf<EventHandler>()
  })
})

describe('nitro v2 compatibility types', () => {
  it('types the `render:response` hook', () => {
    expectTypeOf<Parameters<NitroRuntimeHooks['render:response']>[0]>().toEqualTypeOf<{ body?: string, statusCode?: number, statusMessage?: string, headers?: Record<string, string> }>()
    expectTypeOf<Parameters<NitroRuntimeHooks['render:response']>[1]>().toEqualTypeOf<{ event: H3Event }>()
  })

  it('hands a v1 handler an event that has `event.node`', () => {
    type LegacyEvent = Parameters<Extract<Parameters<typeof defineEventHandler>[0], (...args: any[]) => any>>[0]
    expectTypeOf<LegacyEvent>().toExtend<H3Event>()
    expectTypeOf<LegacyEvent['node']['req']>().toExtend<IncomingMessage>()
    expectTypeOf<LegacyEvent['node']['res']>().toExtend<ServerResponse>()
  })

  it('hands a v1 handler an event that has `event.fetch` and `event.$fetch`', () => {
    type LegacyEvent = Parameters<Extract<Parameters<typeof defineEventHandler>[0], (...args: any[]) => any>>[0]
    expectTypeOf<LegacyEvent['fetch']>().toEqualTypeOf<typeof globalThis.fetch>()
    expectTypeOf<LegacyEvent['$fetch']>().toEqualTypeOf<$Fetch>()
  })

  it('merges an augmentation of `nitropack/types` into the nitro v3 interface', () => {
    expectTypeOf<Parameters<NitroRuntimeHooks['nitro-types-spec:hook']>[0]>().toEqualTypeOf<{ ok: boolean }>()
  })

  it('types the runtime config of `useRuntimeConfig(event)` with the declared keys', () => {
    expectTypeOf<ReturnType<typeof useRuntimeConfig>>().toEqualTypeOf<NitroRuntimeConfig>()
    expectTypeOf<ReturnType<typeof useRuntimeConfig>['nitroTypesSpecKey']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<ReturnType<typeof useRuntimeConfig>['nitroTypesSpecModuleKey']>().toEqualTypeOf<number | undefined>()
  })

  it('accepts route rule keys declared on `nitropack/types` in the route rules Nuxt resolves', () => {
    expectTypeOf<SchemaRouteRuleConfig['nitroTypesSpecRule']>().toEqualTypeOf<{ enabled: boolean } | undefined>()
    expectTypeOf<NonNullable<NuxtPage['rules']>['nitroTypesSpecRule']>().toEqualTypeOf<{ enabled: boolean } | undefined>()
    expectTypeOf<NuxtRouteRuleConfig<{ nuxt4: true }>['nitroTypesSpecRule']>().toEqualTypeOf<{ enabled: boolean } | undefined>()
    expectTypeOf<NuxtRouteRuleConfig<Record<never, never>>['nitroTypesSpecRule']>().toEqualTypeOf<{ enabled: boolean } | undefined>()
  })

  it('types a direct call of a cached handler as the `Response` it resolves to, and its response as what the handler it caches returns', () => {
    const define = () => cacheV2(() => Promise.resolve({ cached: true as const }))
    type Cached = ReturnType<typeof define>
    expectTypeOf(define).returns.returns.toEqualTypeOf<Promise<Response>>()
    expectTypeOf<Cached>().toExtend<EventHandler>()
    expectTypeOf<ReturnType<Awaited<ReturnType<Cached['fetch']>>['json']>>().toEqualTypeOf<Promise<{ cached: true }>>()
    expectTypeOf<ResponseBodyOf<Cached>>().toEqualTypeOf<{ cached: true }>()
    expectTypeOf<ResponseBodyOf<ReturnType<typeof cacheV2<any, null>>>>().toEqualTypeOf<null>()
    expectTypeOf<ResponseBodyOf<ReturnType<typeof cacheV2<any, Response>>>>().toEqualTypeOf<Response>()
  })
})

describe('response types Nuxt generates for routes', () => {
  it('reads the response of a handler that is not cached from what it returns', () => {
    expectTypeOf<ResponseBodyOf<EventHandler<any, Promise<{ id: number }>>>>().toEqualTypeOf<{ id: number }>()
    expectTypeOf<ResponseBodyOf<EventHandlerWithFetch<any, { id: number } | undefined>>>().toEqualTypeOf<{ id: number } | undefined>()
    expectTypeOf<ResponseBodyOf<EventHandler<any, Promise<Response>>>>().toEqualTypeOf<Response>()
    expectTypeOf<ResponseBodyOf<EventHandlerWithFetch<any, Response>>>().toEqualTypeOf<Response>()
    expectTypeOf<ResponseBodyOf<EventHandler>>().toEqualTypeOf<unknown>()
  })

  it('reads the response of a handler cached with `defineCachedHandler` from what the handler it caches returns', () => {
    const define = () => cacheV3(() => Promise.resolve({ cached: true as const }))
    type Cached = ReturnType<typeof define>
    expectTypeOf(define).returns.returns.toEqualTypeOf<Promise<Response>>()
    expectTypeOf<ResponseBodyOf<Cached>>().toEqualTypeOf<{ cached: true }>()
    expectTypeOf<ResponseBodyOf<ReturnType<typeof cacheV3<any, null>>>>().toEqualTypeOf<null>()
    expectTypeOf<ResponseBodyOf<ReturnType<typeof cacheV3<any, Response>>>>().toEqualTypeOf<Response>()
    expectTypeOf<ResponseBodyOf<ReturnType<typeof cacheV3<any, unknown>>>>().toEqualTypeOf<unknown>()
    const untyped = (handler: EventHandler) => cacheV3(handler)
    expectTypeOf(untyped).returns.toEqualTypeOf<ReturnType<typeof cacheV2<EventHandlerRequest, unknown>>>()
  })
})

declare module '@nuxt/schema' {
  interface RuntimeConfig {
    nitroTypesSpecKey?: string
  }
}

declare module '../src/runtime/compat/nitro-v2-types.ts' {
  interface NitroRuntimeHooks {
    'nitro-types-spec:hook': (payload: { ok: boolean }) => void
  }
  interface NitroRuntimeConfig {
    nitroTypesSpecModuleKey?: number
  }
  interface NitroRouteConfig {
    nitroTypesSpecRule?: { enabled: boolean }
  }
}
