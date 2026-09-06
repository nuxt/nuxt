import { expectTypeOf } from 'vitest'
import type { H3Event } from 'h3'
import type { RequestEvent, RuntimeRequestEvent } from 'nuxt/server'
import { defineEventHandler, getRequestURL, getRouteRules } from 'nuxt/server'

// @ts-expect-error Fromage is 'cheese'
const _fake: Fromage = 'babybel'

const _fromage: Fromage = 'cheese'

const appConfig = useAppConfig()
expectTypeOf(appConfig.fromNuxtConfig).toEqualTypeOf<boolean>()
expectTypeOf(appConfig.userConfig).toEqualTypeOf<123 | 456 | undefined>()
expectTypeOf(appConfig.fromLayer).toEqualTypeOf<unknown>()

expectTypeOf(import.meta.dev).toEqualTypeOf<boolean>()
expectTypeOf(import.meta.test).toEqualTypeOf<boolean>()

// the event this server runtime contributes, which the portable surface does not expose
expectTypeOf<RuntimeRequestEvent>().toEqualTypeOf<H3Event>()
expectTypeOf<H3Event>().toExtend<RequestEvent>()

const portableHandler = defineEventHandler((event) => {
  expectTypeOf(event).toEqualTypeOf<RequestEvent>()
  expectTypeOf(getRequestURL(event)).toEqualTypeOf<URL>()
  expectTypeOf(getRouteRules(event)).toExtend<{ ssr?: boolean }>()
  expectTypeOf(event.context).toEqualTypeOf<Record<string, unknown>>()

  // nitropack v2's event is what arrives, but reading it is not portable to h3 v2, so the
  // surface does not type it: that narrowing is the point
  // @ts-expect-error `node` is not part of the portable event
  void event.node
  // @ts-expect-error `path` is not part of the portable event
  void event.path

  // reaching for the runtime's own event is possible, and says so at the call site
  expectTypeOf(event as RuntimeRequestEvent).toEqualTypeOf<H3Event>()

  return { greeting: 'hello' }
})

expectTypeOf(portableHandler).returns.toEqualTypeOf<{ greeting: string }>()
