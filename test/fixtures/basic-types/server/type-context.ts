import { expectTypeOf } from 'vitest'
import type { H3Event } from 'h3'
import { handleCors } from 'h3'
import type { NuxtRequestEvent, RequestEvent, RequestEventContext } from 'nuxt/server'
import { defineEventHandler, getRequestURL, getRouteRules, toNuxtRequestEvent } from 'nuxt/server'

// @ts-expect-error Fromage is 'cheese'
const _fake: Fromage = 'babybel'

const _fromage: Fromage = 'cheese'

const appConfig = useAppConfig()
expectTypeOf(appConfig.fromNuxtConfig).toEqualTypeOf<boolean>()
expectTypeOf(appConfig.userConfig).toEqualTypeOf<123 | 456 | undefined>()
expectTypeOf(appConfig.fromLayer).toEqualTypeOf<unknown>()

expectTypeOf(import.meta.dev).toEqualTypeOf<boolean>()
expectTypeOf(import.meta.test).toEqualTypeOf<boolean>()

// the event this server runtime contributes
expectTypeOf<NuxtRequestEvent>().toEqualTypeOf<H3Event>()

const portableHandler = defineEventHandler((event) => {
  expectTypeOf(event).toEqualTypeOf<RequestEvent>()
  expectTypeOf(getRequestURL(event)).toEqualTypeOf<URL>()
  expectTypeOf(getRouteRules(event)).toExtend<{ ssr?: boolean }>()

  expectTypeOf(event.req).toEqualTypeOf<Request>()
  expectTypeOf(event.url).toEqualTypeOf<URL>()
  expectTypeOf(event.res.headers).toEqualTypeOf<Headers>()
  expectTypeOf(event.context).toEqualTypeOf<RequestEventContext>()

  // @ts-expect-error `node` is not part of the portable event
  void event.node
  // @ts-expect-error `path` is not part of the portable event
  void event.path

  // the runtime's own event, for the helpers that need it
  const runtimeEvent = toNuxtRequestEvent(event)
  expectTypeOf(runtimeEvent).toEqualTypeOf<H3Event>()
  expectTypeOf(runtimeEvent.node).not.toBeNever()
  handleCors(runtimeEvent, { origin: '*' })

  return { greeting: 'hello' }
})

expectTypeOf(portableHandler).returns.toEqualTypeOf<{ greeting: string }>()
