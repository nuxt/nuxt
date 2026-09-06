import { describe, expect, expectTypeOf, it } from 'vitest'
import { resolveModuleExportNames } from '@nuxt/kit/internal'
import type { CookieSerializeOptions } from 'cookie-es'
import type { AppRouteRules, RuntimeConfig } from 'nuxt/schema'

import type {
  EventHandler,
  NuxtErrorDetails,
  NuxtErrorJSON,
  NuxtErrorLike,
  RequestEvent,
  RequestEventFallback,
  RuntimeRequestEvent,
  ServerRoutes,
} from '../src/server/index.ts'

/**
 * `nuxt/server` exists on 4.x so that server code can be written once and survive the
 * upgrade to a server runtime built on h3 v2, so its surface has to match the one on
 * `main`: a name or signature here and not there is code that breaks on upgrade, and one
 * there and not here is a hole in the early-upgrade path.
 *
 * The reference below is copied from `packages/nuxt/src/server/index.ts` on `main`, which
 * types the event as the same portable {@link RequestEvent} this branch does. The event
 * parameter is written as the minimum both carry, so that a signature difference in what
 * either branch narrows to would still be caught.
 */
interface MainSurface {
  defineEventHandler: <Result>(handler: (event: EventLike) => Result) => (event: EventLike) => Result
  createError: (...args: never[]) => Error
  isNuxtError: (error: unknown) => boolean
  getRequestURL: (event: EventLike) => URL
  getRequestHeader: (event: EventLike, name: string) => string | undefined
  getRequestHeaders: (event: EventLike) => Record<string, string>
  setResponseStatus: (event: EventLike, status: number, statusText?: string) => void
  setResponseHeader: (event: EventLike, name: string, value: string) => void
  setResponseHeaders: (event: EventLike, headers: Record<string, string>) => void
  getQuery: <T extends Record<string, unknown> = Record<string, string | string[]>>(event: EventLike) => T
  readBody: <T = unknown>(event: EventLike) => Promise<T>
  getCookie: (event: EventLike, name: string) => string | undefined
  setCookie: (event: EventLike, name: string, value: string, options?: CookieSerializeOptions) => void
  deleteCookie: (event: EventLike, name: string, options?: CookieSerializeOptions) => void
  sendRedirect: (event: EventLike, location: string, status?: number) => string
  getRouteRules: (event: EventLike) => AppRouteRules
  useRuntimeConfig: () => RuntimeConfig
}

/** The portable minimum: what both branches' event types carry. */
interface EventLike {
  readonly context: Record<string, unknown>
}

/** Value exports `main` has, in the order they are declared there. */
const MAIN_VALUE_EXPORTS = [
  'defineEventHandler',
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

/**
 * `main` exports the `NuxtError` class as a value. 4.x's error is h3 v1's, which is not
 * constructible with the same arguments, so only the type is exported here and
 * `createError()` is how an error is made on both.
 */
const MAIN_ONLY_VALUE_EXPORTS = ['NuxtError']

describe('the `nuxt/server` surface against `main`', () => {
  it('carries every value export `main` does, and nothing beyond them', async () => {
    const names = await resolveModuleExportNames(new URL('../src/server/index.ts', import.meta.url).pathname, { url: import.meta.url })

    expect(names.filter(name => !MAIN_VALUE_EXPORTS.includes(name))).toEqual([])
    expect(MAIN_VALUE_EXPORTS.filter(name => !names.includes(name))).toEqual(MAIN_ONLY_VALUE_EXPORTS)
  })

  it('types every export the way `main` types it', () => {
    // a call written against this surface type-checks against `main`'s
    expectTypeOf<typeof import('../src/server/index.ts')>().toExtend<MainSurface>()
  })

  it('carries every type export `main` does', () => {
    // the imports above are the assertion: a missing name is a compile error. The shapes
    // are checked where they are load-bearing, in `server-surface.test.ts`.
    expectTypeOf<EventHandler<string>>().toBeFunction()
    expectTypeOf<NuxtErrorLike>().toExtend<Error>()
    expectTypeOf<RequestEvent>().toEqualTypeOf<EventLike>()
    expectTypeOf<RuntimeRequestEvent>().not.toBeNever()
    expectTypeOf<RequestEventFallback['url']>().toEqualTypeOf<URL>()
    expectTypeOf<NuxtErrorDetails>().not.toBeNever()
    expectTypeOf<NuxtErrorJSON>().not.toBeNever()
    expectTypeOf<ServerRoutes>().not.toBeNever()
    expectTypeOf<AppRouteRules>().not.toBeNever()
  })
})
