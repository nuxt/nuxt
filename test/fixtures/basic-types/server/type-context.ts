import { expectTypeOf } from 'vitest'
import type { H3Event } from 'nitro/h3'
import type { RequestEvent } from 'nuxt/server'
import { defineEventHandler, getRequestURL, getRouteRules } from 'nuxt/server'

// @ts-expect-error Fromage is 'cheese'
const _fake: Fromage = 'babybel'

const _fromage: Fromage = 'cheese'

const appConfig = useAppConfig()
expectTypeOf(appConfig.fromNuxtConfig).toEqualTypeOf<boolean>()
expectTypeOf(appConfig.userConfig).toEqualTypeOf<123 | 456 | undefined>()
expectTypeOf(appConfig.fromLayer).toEqualTypeOf<unknown>()

expectTypeOf<RequestEvent>().toEqualTypeOf<H3Event>()

const portableHandler = defineEventHandler((event) => {
  expectTypeOf(event).toEqualTypeOf<H3Event>()
  expectTypeOf(getRequestURL(event)).toEqualTypeOf<URL>()
  expectTypeOf(getRouteRules(event)).toExtend<{ ssr?: boolean }>()

  return { greeting: 'hello' }
})

expectTypeOf(portableHandler).returns.toEqualTypeOf<{ greeting: string }>()
