import { describe, expectTypeOf, it } from 'vitest'
import type { NitroInstance, NitroInstanceOptions } from '@nuxt/kit'
import type { NuxtConfig, NuxtHooks, NuxtOptions, NuxtPage, NuxtRequestEvent, RouteRuleConfig as SchemaRouteRuleConfig, TSReference } from '@nuxt/schema'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Nitro, NitroConfig, NitroOptions, NitroRuntimeHooks, RouteRuleConfig, TracingChannelOptions } from 'nitro/types'
import type { EventHandler, H3Event } from 'nitro/h3'
import type { NuxtSSRContext } from '#app/types'

import type {} from '../src/augments.ts'
import type { defineEventHandler } from '../src/runtime/compat/h3-v1.ts'

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
})
