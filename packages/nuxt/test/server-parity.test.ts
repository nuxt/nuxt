import { describe, expect, expectTypeOf, it } from 'vitest'
import { resolveModuleExportNames } from '@nuxt/kit/internal'
import type { CookieSerializeOptions } from 'cookie-es'
import type { AppRouteRules, RuntimeConfig } from 'nuxt/schema'

import type {
  EventHandler,
  NuxtErrorDetails,
  NuxtErrorJSON,
  NuxtErrorLike,
  NuxtRequestEvent,
  RequestEvent,
  RequestEventContext,
  ServerRoutes,
} from '../src/server/index.ts'

/**
 * Every name and signature `nuxt/server` has on `main` has to exist here too, so that
 * server code written here survives the upgrade.
 *
 * The reference below is `main`'s surface. One difference is expected: `NuxtError` is a
 * value there, where here it is a type only, because 4.x's error is h3 v1's and is not
 * constructible with the same arguments.
 */
interface MainSurface {
  defineEventHandler: <Result>(handler: (event: RequestEvent) => Result) => (event: RequestEvent) => Result
  toNuxtRequestEvent: (event: RequestEvent) => NuxtRequestEvent
  createError: (...args: never[]) => Error
  isNuxtError: (error: unknown) => boolean
  getRequestURL: (event: RequestEvent) => URL
  getRequestHeader: (event: RequestEvent, name: string) => string | undefined
  getRequestHeaders: (event: RequestEvent) => Record<string, string>
  setResponseStatus: (event: RequestEvent, status: number, statusText?: string) => void
  setResponseHeader: (event: RequestEvent, name: string, value: string) => void
  setResponseHeaders: (event: RequestEvent, headers: Record<string, string>) => void
  getQuery: <T extends Record<string, unknown> = Record<string, string | string[]>>(event: RequestEvent) => T
  readBody: <T = unknown>(event: RequestEvent) => Promise<T>
  getCookie: (event: RequestEvent, name: string) => string | undefined
  setCookie: (event: RequestEvent, name: string, value: string, options?: CookieSerializeOptions) => void
  deleteCookie: (event: RequestEvent, name: string, options?: CookieSerializeOptions) => void
  sendRedirect: (event: RequestEvent, location: string, status?: number) => string
  getRouteRules: (event: RequestEvent) => AppRouteRules
  useRuntimeConfig: () => RuntimeConfig
}

/** Value exports `main` has. */
const MAIN_VALUE_EXPORTS = [
  'defineEventHandler',
  'toNuxtRequestEvent',
  'createError',
  'NuxtError',
  'isNuxtError',
  'getRequestURL',
  'getRequestHeader',
  'getRequestHeaders',
  'setResponseStatus',
  'setResponseHeader',
  'setResponseHeaders',
  'getQuery',
  'readBody',
  'getCookie',
  'setCookie',
  'deleteCookie',
  'sendRedirect',
  'getRouteRules',
  'useRuntimeConfig',
]

/** Value exports only `main` has. */
const MAIN_ONLY_VALUE_EXPORTS = ['NuxtError']

describe('the `nuxt/server` surface against `main`', () => {
  it('carries every value export `main` does but `NuxtError`, and nothing else', async () => {
    const names = await resolveModuleExportNames(new URL('../src/server/index.ts', import.meta.url).pathname, { url: import.meta.url })

    expect(names.filter(name => !MAIN_VALUE_EXPORTS.includes(name))).toEqual([])
    expect(MAIN_VALUE_EXPORTS.filter(name => !names.includes(name))).toEqual(MAIN_ONLY_VALUE_EXPORTS)
  })

  it('types every export the way `main` types it', () => {
    // a call written here type-checks against `main`'s surface
    expectTypeOf<typeof import('../src/server/index.ts')>().toExtend<MainSurface>()
  })

  it('types the event the way `main` types it', () => {
    expectTypeOf<RequestEvent['req']>().toEqualTypeOf<Request>()
    expectTypeOf<RequestEvent['url']>().toEqualTypeOf<URL>()
    expectTypeOf<RequestEvent['res']['headers']>().toEqualTypeOf<Headers>()
    expectTypeOf<RequestEvent['context']>().toExtend<Record<string, unknown>>()
  })

  it('carries every type export `main` does', () => {
    // the imports above are the assertion: a missing name is a compile error
    expectTypeOf<EventHandler<string>>().toBeFunction()
    expectTypeOf<NuxtErrorLike>().toExtend<Error>()
    expectTypeOf<NuxtRequestEvent>().not.toBeNever()
    expectTypeOf<RequestEventContext>().toExtend<Record<string, unknown>>()
    expectTypeOf<NuxtErrorDetails>().not.toBeNever()
    expectTypeOf<NuxtErrorJSON>().not.toBeNever()
    expectTypeOf<ServerRoutes>().not.toBeNever()
    expectTypeOf<AppRouteRules>().not.toBeNever()
  })
})
