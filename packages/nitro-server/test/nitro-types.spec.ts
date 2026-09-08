import { describe, expectTypeOf, it } from 'vitest'
import type { NitroInstance, NitroInstanceOptions } from '@nuxt/kit'
import type { NuxtConfig, NuxtHooks, NuxtOptions, NuxtPage, NuxtRequestEvent, RouteRuleConfig as SchemaRouteRuleConfig, TSReference } from '@nuxt/schema'
import type { Nitro, NitroConfig, NitroOptions, NitroRouteConfig } from 'nitropack/types'
import type { EventHandler, H3Event } from 'h3'
import type { NuxtSSRContext } from '#app/types'

import type {} from '../src/augments.ts'

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
    expectTypeOf<NuxtOptions['nitro']>().toEqualTypeOf<NitroConfig>()
    expectTypeOf<NuxtConfig['nitro']>().toEqualTypeOf<NitroConfig | undefined>()
    expectTypeOf<NuxtOptions['routeRules']>().toEqualTypeOf<Record<string, NitroRouteConfig> | undefined>()
    expectTypeOf<NuxtOptions['tracingChannel']>().toEqualTypeOf<boolean | ({ nuxt?: boolean } & { srvx?: boolean, h3?: boolean, unstorage?: boolean })>()
  })

  it('resolves the route rules a page may declare', () => {
    expectTypeOf<NuxtPage['rules']>().toEqualTypeOf<NitroRouteConfig | undefined>()
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
    expectTypeOf<NitroRouteConfig['appLayout']>().toEqualTypeOf<'generated' | false | undefined>()
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
