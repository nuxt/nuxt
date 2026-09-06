import { expectTypeOf } from 'vitest'
import type { H3Event } from 'nitro/h3'
import { getRouterParam, handleCors, useSession } from 'nitro/h3'
import type { NuxtRequestEvent, RequestEvent, RequestEventContext } from 'nuxt/server'
import { defineEventHandler, getRequestURL, getRouteRules, toNuxtRequestEvent } from 'nuxt/server'

// @ts-expect-error Fromage is 'cheese'
const _fake: Fromage = 'babybel'

const _fromage: Fromage = 'cheese'

const appConfig = useAppConfig()
expectTypeOf(appConfig.fromNuxtConfig).toEqualTypeOf<boolean>()
expectTypeOf(appConfig.userConfig).toEqualTypeOf<123 | 456 | undefined>()
expectTypeOf(appConfig.fromLayer).toEqualTypeOf<unknown>()

// the event this server runtime contributes
expectTypeOf<NuxtRequestEvent>().toEqualTypeOf<H3Event>()
expectTypeOf<H3Event>().toExtend<RequestEvent>()

const portableHandler = defineEventHandler(async (event) => {
  expectTypeOf(event).toEqualTypeOf<RequestEvent>()
  expectTypeOf(getRequestURL(event)).toEqualTypeOf<URL>()
  expectTypeOf(getRouteRules(event)).toExtend<{ ssr?: boolean }>()

  expectTypeOf(event.req).toEqualTypeOf<Request>()
  expectTypeOf(event.url).toEqualTypeOf<URL>()
  expectTypeOf(event.res.headers).toEqualTypeOf<Headers>()
  expectTypeOf(event.context).toEqualTypeOf<RequestEventContext>()

  // h3 helpers that only read the request take it directly
  expectTypeOf(getRouterParam(event, 'id')).toEqualTypeOf<string | undefined>()
  await useSession(event, { password: '0'.repeat(32) })

  // @ts-expect-error `node` is not part of the portable event
  void event.node
  // @ts-expect-error `runtime` is not part of the portable event
  void event.runtime
  // @ts-expect-error `waitUntil` is not part of the portable event
  void event.waitUntil

  // the runtime's own event, for the helpers that need it
  const runtimeEvent = toNuxtRequestEvent(event)
  expectTypeOf(runtimeEvent).toEqualTypeOf<H3Event>()
  expectTypeOf(runtimeEvent.node).not.toBeNever()
  handleCors(runtimeEvent, { origin: '*' })

  // the same value, so a cast reaches it too
  expectTypeOf(event as NuxtRequestEvent).toEqualTypeOf<H3Event>()

  return { greeting: 'hello' }
})

expectTypeOf(portableHandler).returns.toEqualTypeOf<Promise<{ greeting: string }>>()
