import { describe, expectTypeOf, it } from 'vitest'
import type { Ref, SlotsType } from 'vue'
import type { NavigationFailure, RouteLocationNormalized, RouteLocationRaw, Router, useRouter as vueUseRouter } from 'vue-router'

import type { DynamicParam, Endpoint, HTTPMethod, TypedFetch, TypedFetchRequest } from 'nuxt/app'
import type { H3Event, HTTPError } from 'nitro/h3'
import { $fetch } from '#build/fetch'
import type { AppConfig, AppConfigInput, NuxtConfig as NuxtConfigFromAt, NuxtHooks as NuxtHooksFromAt } from '@nuxt/schema'
import type { AppConfigInput as AppConfigInputFromNuxt, NuxtConfig as NuxtConfigFromNuxt, NuxtHooks as NuxtHooksFromNuxt } from 'nuxt/schema'
import { defineNuxtConfig } from 'nuxt/config'
import { callWithNuxt, isVue3 } from '#app'
import type { NuxtError, NuxtSSRContext, PageMeta, RequestEvent } from '#app'
import type { NavigateToOptions } from '#app/composables/router'
import { LazyWithTypes, NuxtIsland, NuxtLayout, NuxtLink, NuxtPage, ServerComponent, WithTypes } from '#components'
import type { IslandComponent, LazyComponent } from '#components'
import { getRouteRules, prefetchComponents, preloadComponents, useRequestEvent, useRouter } from '#imports'
import type { LayoutKey } from '#build/types/nitro-layouts'

type DefaultAsyncDataErrorValue = undefined
type DefaultAsyncDataValue = undefined

interface TestResponse { message: string }

// modules and users can contribute routes the server builder did not scan
declare module '@nuxt/schema' {
  interface ServerRoutes {
    '/api/augmented': {
      [Endpoint]: { GET: { response: { augmented: true } }, POST: { response: { created: true } } }
      [DynamicParam]: { [Endpoint]: Record<HTTPMethod, { response: number }> }
    }
    '/api/augmented-mixed': {
      [Endpoint]: {
        GET: { response: { augmented: true } }
        POST: { response: { created: true }, body: { title: string } }
      }
    }
    '/api/augmented-request': {
      [Endpoint]: {
        POST: {
          response: { created: true }
          body: { title: string }
          query: { page: string }
          headers: { 'x-token': string }
        }
      }
    }
  }
}

declare module 'nuxt/app' {
  interface NuxtLayouts {
    withFunction: {
      someProp: number
      function: () => void
    }
  }
}

// Hook augmentation bridge between `@nuxt/schema` and `nuxt/schema`.
//
// `_local-modules/hook-augmenting-module/types.d.mts` augments
// `@nuxt/schema { interface NuxtHooks }` with `'hook-augmenting-module:ping'`
// and is pulled in via `<reference types="hook-augmenting-module" />` in
// `.nuxt/nuxt*.d.ts` (the path real published modules take).
//
// Regression test for the bug where `declare module '@nuxt/schema'` augments
// of `NuxtHooks` were visible on `NuxtHooks` directly but not on
// `NuxtConfig['hooks']` when read via `nuxt/schema` — the path
// `defineNuxtConfig` types take. See `packages/nuxt/schema.d.ts`.
expectTypeOf<'hook-augmenting-module:ping'>().toExtend<keyof NuxtHooksFromAt>()
expectTypeOf<'hook-augmenting-module:ping'>().toExtend<keyof NuxtHooksFromNuxt>()
expectTypeOf<'hook-augmenting-module:ping'>().toExtend<keyof NonNullable<NuxtConfigFromAt['hooks']>>()
expectTypeOf<'hook-augmenting-module:ping'>().toExtend<keyof NonNullable<NuxtConfigFromNuxt['hooks']>>()

defineNuxtConfig({
  hooks: {
    'hook-augmenting-module:ping' (payload) {
      expectTypeOf(payload).toEqualTypeOf<{ value: number }>()
    },
  },
})

describe('API routes', () => {
  it('types the auto-imported $fetch with nitro routes', () => {
    // https://github.com/nuxt/nuxt/pull/35582 regression: `$fetch` was typed as
    // ofetch's plain `$fetch`, returning `Promise<any>` for every request
    expectTypeOf($fetch).toEqualTypeOf<TypedFetch>()
    expectTypeOf($fetch('/api/hello')).toEqualTypeOf<Promise<string>>()
  })

  it('types the response of a handler written against `nuxt/server`', () => {
    expectTypeOf($fetch('/api/portable')).toEqualTypeOf<Promise<{ greeting: string }>>()
  })

  it('types responses of routes contributed by augmentation', () => {
    expectTypeOf($fetch('/api/augmented')).toEqualTypeOf<Promise<{ augmented: true }>>()
    expectTypeOf($fetch('/api/augmented', { method: 'GET' })).toEqualTypeOf<Promise<{ augmented: true }>>()
    expectTypeOf($fetch('/api/augmented', { method: 'post' })).toEqualTypeOf<Promise<{ created: true }>>()
    // a concrete segment resolves through the augmented parameter
    expectTypeOf($fetch('/api/augmented/anything')).toEqualTypeOf<Promise<number>>()
    // a segment known only at runtime does not, where the route is contributed by augmentation: the
    // emitted path union covers generated routes only, so the request falls to the signature that
    // validates the path, and intersecting the validator onto the parameter stops a template
    // literal from inferring as one. Concrete paths to augmented routes and template paths to
    // generated routes both work; only the two together do not.
    expectTypeOf($fetch(`/api/augmented/${String(Math.random())}`)).toEqualTypeOf<Promise<unknown>>()
  })

  it('registers scanned routes, including those from layers and modules', () => {
    // responses are asserted separately: a handler's own type is `any` in this program until
    // nitro's generated auto-imports resolve, which would make a response assertion vacuous
    expectTypeOf<'/api/hello'>().toExtend<TypedFetchRequest>()
    expectTypeOf<'/api/hey'>().toExtend<TypedFetchRequest>()
    expectTypeOf<'/api/posts/static'>().toExtend<TypedFetchRequest>()
    expectTypeOf<'/api/foo'>().toExtend<TypedFetchRequest>()
    expectTypeOf<'/auto-registered-module'>().toExtend<TypedFetchRequest>()
  })

  it('rejects requests to unregistered routes', () => {
    // @ts-expect-error no GET route matches '/api/unregistered'
    $fetch('/api/unregistered')
    // @ts-expect-error no PATCH route matches '/api/unregistered'
    $fetch('/api/unregistered', { method: 'PATCH' })
    // naming the response type turns inference off for the request, so the path is passed through
    expectTypeOf($fetch<TestResponse>('/api/unregistered')).toEqualTypeOf<Promise<TestResponse>>()
  })

  it('types responses of augmented routes through `useFetch`', () => {
    expectTypeOf(useFetch('/api/augmented').data).toEqualTypeOf<Ref<{ augmented: true } | DefaultAsyncDataValue>>()
    expectTypeOf(useFetch('/api/augmented', { method: 'post' }).data).toEqualTypeOf<Ref<{ created: true } | DefaultAsyncDataValue>>()
    expectTypeOf(useFetch('/api/augmented', { pick: ['augmented'] }).data).toEqualTypeOf<Ref<{ augmented: true } | DefaultAsyncDataValue>>()
    expectTypeOf(useRequestFetch()('/api/augmented')).toEqualTypeOf<Promise<{ augmented: true }>>()
  })

  it('generates types for routes', () => {
    expectTypeOf($fetch('/api/hello')).toEqualTypeOf<Promise<string>>()
    // registered in extends
    expectTypeOf($fetch('/api/foo')).toEqualTypeOf<Promise<string>>()
    // registered in module
    expectTypeOf($fetch('/auto-registered-module')).toEqualTypeOf<Promise<string>>()
    expectTypeOf($fetch('/api/hey')).toEqualTypeOf<Promise<{ foo: string, baz: string }>>()
    expectTypeOf($fetch('/api/hey', { method: 'get' })).toEqualTypeOf<Promise<{ foo: string, baz: string }>>()
    expectTypeOf($fetch('/api/hey', { method: 'post' })).toEqualTypeOf<Promise<{ method: 'post' }>>()
    // @ts-expect-error not a valid method
    expectTypeOf($fetch('/api/hey', { method: 'patch' })).toEqualTypeOf<Promise<{ foo: string, baz: string }>>()
    expectTypeOf($fetch('/api/union')).toEqualTypeOf<Promise<{ type: 'a', foo: string } | { type: 'b', baz: string }>>()
    expectTypeOf($fetch('/api/hello')).toEqualTypeOf<Promise<string>>()
    expectTypeOf($fetch<TestResponse>('/api/hello')).toEqualTypeOf<Promise<TestResponse>>()
  })

  it('works with useRequestFetch', () => {
    const $fetch = useRequestFetch()
    expectTypeOf($fetch('/api/hello')).toEqualTypeOf<Promise<string>>()
    // registered in extends
    expectTypeOf($fetch('/api/foo')).toEqualTypeOf<Promise<string>>()
    // registered in module
    expectTypeOf($fetch('/auto-registered-module')).toEqualTypeOf<Promise<string>>()
    expectTypeOf($fetch('/api/hey')).toEqualTypeOf<Promise<{ foo: string, baz: string }>>()
    expectTypeOf($fetch('/api/hey', { method: 'get' })).toEqualTypeOf<Promise<{ foo: string, baz: string }>>()
    expectTypeOf($fetch('/api/hey', { method: 'post' })).toEqualTypeOf<Promise<{ method: 'post' }>>()
    // @ts-expect-error not a valid method
    expectTypeOf($fetch('/api/hey', { method: 'patch' })).toEqualTypeOf<Promise<{ foo: string, baz: string }>>()
    expectTypeOf($fetch('/api/union')).toEqualTypeOf<Promise<{ type: 'a', foo: string } | { type: 'b', baz: string }>>()
    expectTypeOf($fetch('/api/hello')).toEqualTypeOf<Promise<string>>()
    expectTypeOf($fetch<TestResponse>('/api/hello')).toEqualTypeOf<Promise<TestResponse>>()
  })

  it('works with useAsyncData', () => {
    expectTypeOf(useAsyncData('api-hello', () => $fetch('/api/hello')).data).toEqualTypeOf<Ref<string | DefaultAsyncDataValue>>()
    expectTypeOf(useAsyncData('api-hey', () => $fetch('/api/hey')).data).toEqualTypeOf<Ref<{ foo: string, baz: string } | DefaultAsyncDataValue>>()
    expectTypeOf(useAsyncData('api-hey-with-pick', () => $fetch('/api/hey'), { pick: ['baz'] }).data).toEqualTypeOf<Ref<{ baz: string } | DefaultAsyncDataValue>>()
    expectTypeOf(useAsyncData('api-union', () => $fetch('/api/union')).data).toEqualTypeOf<Ref<{ type: 'a', foo: string } | { type: 'b', baz: string } | DefaultAsyncDataValue>>()
    expectTypeOf(useAsyncData('api-union-with-pick', () => $fetch('/api/union'), { pick: ['type'] }).data).toEqualTypeOf<Ref<{ type: 'a' } | { type: 'b' } | DefaultAsyncDataValue>>()
    expectTypeOf(useAsyncData('api-hello', () => $fetch('/api/hello')).data).toEqualTypeOf<Ref<string | DefaultAsyncDataValue>>()
    expectTypeOf(useAsyncData<TestResponse>('api-generics', () => $fetch('/api/hello')).data).toEqualTypeOf<Ref<TestResponse | DefaultAsyncDataValue>>()

    expectTypeOf(useAsyncData('api-error-generics', () => $fetch('/api/hello')).error).toEqualTypeOf<Ref<NuxtError<unknown> | DefaultAsyncDataErrorValue>>()
    expectTypeOf(useAsyncData<any, string>('api-error-generics', () => $fetch('/api/hello')).error).toEqualTypeOf<Ref<NuxtError<string> | DefaultAsyncDataErrorValue>>()
    // backwards compatibility
    expectTypeOf(useAsyncData<any, Error>('api-error-generics', () => $fetch('/api/hello')).error).toEqualTypeOf<Ref<Error | DefaultAsyncDataErrorValue>>()
    expectTypeOf(useAsyncData<any, NuxtError<string>>('api-error-generics', () => $fetch('/api/hello')).error).toEqualTypeOf<Ref<NuxtError<string> | DefaultAsyncDataErrorValue>>()

    expectTypeOf(useLazyAsyncData('lazy-api-hello', () => $fetch('/api/hello')).data).toEqualTypeOf<Ref<string | DefaultAsyncDataValue>>()
    expectTypeOf(useLazyAsyncData('lazy-api-hey', () => $fetch('/api/hey')).data).toEqualTypeOf<Ref<{ foo: string, baz: string } | DefaultAsyncDataValue>>()
    expectTypeOf(useLazyAsyncData('lazy-api-hey-with-pick', () => $fetch('/api/hey'), { pick: ['baz'] }).data).toEqualTypeOf<Ref<{ baz: string } | DefaultAsyncDataValue>>()
    expectTypeOf(useLazyAsyncData('lazy-api-union', () => $fetch('/api/union')).data).toEqualTypeOf<Ref<{ type: 'a', foo: string } | { type: 'b', baz: string } | DefaultAsyncDataValue>>()
    expectTypeOf(useLazyAsyncData('lazy-api-union-with-pick', () => $fetch('/api/union'), { pick: ['type'] }).data).toEqualTypeOf<Ref<{ type: 'a' } | { type: 'b' } | DefaultAsyncDataValue>>()
    expectTypeOf(useLazyAsyncData('lazy-api-hello', () => $fetch('/api/hello')).data).toEqualTypeOf<Ref<string | DefaultAsyncDataValue>>()
    expectTypeOf(useLazyAsyncData<TestResponse>('lazy-api-generics', () => $fetch('/api/hello')).data).toEqualTypeOf<Ref<TestResponse | DefaultAsyncDataValue>>()

    expectTypeOf(useLazyAsyncData('lazy-error-generics', () => $fetch('/api/hello')).error).toEqualTypeOf<Ref<NuxtError<unknown> | DefaultAsyncDataErrorValue>>()
    expectTypeOf(useLazyAsyncData<any, string>('lazy-error-generics', () => $fetch('/api/hello')).error).toEqualTypeOf<Ref<NuxtError<string> | DefaultAsyncDataErrorValue>>()
  })

  it('works with useFetch', () => {
    expectTypeOf(useFetch('/api/hello').data).toEqualTypeOf<Ref<string | DefaultAsyncDataValue>>()
    expectTypeOf(useFetch('/api/hey').data).toEqualTypeOf<Ref<{ foo: string, baz: string } | DefaultAsyncDataValue>>()
    expectTypeOf(useFetch('/api/hey', { method: 'GET' }).data).toEqualTypeOf<Ref<{ foo: string, baz: string } | DefaultAsyncDataValue>>()
    expectTypeOf(useFetch('/api/hey', { method: 'get' }).data).toEqualTypeOf<Ref<{ foo: string, baz: string } | DefaultAsyncDataValue>>()
    expectTypeOf(useFetch('/api/hey', { method: 'POST' }).data).toEqualTypeOf<Ref<{ method: 'post' } | DefaultAsyncDataValue>>()
    expectTypeOf(useFetch('/api/hey', { method: 'post' }).data).toEqualTypeOf<Ref<{ method: 'post' } | DefaultAsyncDataValue>>()
    // @ts-expect-error not a valid method
    useFetch('/api/hey', { method: 'PATCH' })
    expectTypeOf(useFetch('/api/hey', { pick: ['baz'] }).data).toEqualTypeOf<Ref<{ baz: string } | DefaultAsyncDataValue>>()
    expectTypeOf(useFetch('/api/union').data).toEqualTypeOf<Ref<{ type: 'a', foo: string } | { type: 'b', baz: string } | DefaultAsyncDataValue>>()
    expectTypeOf(useFetch('/api/union', { pick: ['type'] }).data).toEqualTypeOf<Ref<{ type: 'a' } | { type: 'b' } | DefaultAsyncDataValue>>()
    expectTypeOf(useFetch('/api/hello').data).toEqualTypeOf<Ref<string | DefaultAsyncDataValue>>()
    // https://github.com/nuxt/nuxt/issues/22488 — dynamic + static handlers on the same prefix
    const dynamicId = String(Math.random())
    expectTypeOf(useFetch(`/api/posts/${dynamicId}`).data).toEqualTypeOf<Ref<number | string | DefaultAsyncDataValue>>()
    expectTypeOf(useFetch('/api/posts/static').data).toEqualTypeOf<Ref<string | DefaultAsyncDataValue>>()
    expectTypeOf($fetch(`/api/posts/${dynamicId}`)).toEqualTypeOf<Promise<number | string>>()
    expectTypeOf(useFetch<TestResponse>('/api/hello').data).toEqualTypeOf<Ref<TestResponse | DefaultAsyncDataValue>>()
    expectTypeOf(useFetch<TestResponse>('/api/hello', { method: 'POST' }).data).toEqualTypeOf<Ref<TestResponse | DefaultAsyncDataValue>>()

    // https://github.com/nuxt/nuxt/issues/22753
    expectTypeOf(useFetch('/api/hello').error).toEqualTypeOf<Ref<NuxtError<unknown> | DefaultAsyncDataErrorValue>>()
    expectTypeOf(useFetch<any, string>('/api/hello').error).toEqualTypeOf<Ref<string | DefaultAsyncDataErrorValue>>()

    expectTypeOf(useLazyFetch('/api/hello').data).toEqualTypeOf<Ref<string | DefaultAsyncDataValue>>()
    expectTypeOf(useLazyFetch('/api/hey').data).toEqualTypeOf<Ref<{ foo: string, baz: string } | DefaultAsyncDataValue>>()
    expectTypeOf(useLazyFetch('/api/hey', { pick: ['baz'] }).data).toEqualTypeOf<Ref<{ baz: string } | DefaultAsyncDataValue>>()
    expectTypeOf(useLazyFetch('/api/union').data).toEqualTypeOf<Ref<{ type: 'a', foo: string } | { type: 'b', baz: string } | DefaultAsyncDataValue>>()
    expectTypeOf(useLazyFetch('/api/union', { pick: ['type'] }).data).toEqualTypeOf<Ref<{ type: 'a' } | { type: 'b' } | DefaultAsyncDataValue>>()
    expectTypeOf(useLazyFetch('/api/hello').data).toEqualTypeOf<Ref<string | DefaultAsyncDataValue>>()
    expectTypeOf(useLazyFetch<TestResponse>('/api/hello').data).toEqualTypeOf<Ref<TestResponse | DefaultAsyncDataValue>>()

    expectTypeOf(useLazyFetch('/api/hello').error).toEqualTypeOf<Ref<NuxtError<unknown> | DefaultAsyncDataErrorValue>>()
    expectTypeOf(useLazyFetch<any, string>('/api/hello').error).toEqualTypeOf<Ref<string | DefaultAsyncDataErrorValue>>()
  })

  it('works with useFetch and generic type', () => {
    type ApiResponse = { message: string }

    useFetch<ApiResponse>('/api/v1/users', {
      onResponse ({ response }) {
        expectTypeOf(response._data).toEqualTypeOf<ApiResponse | undefined>()
      },
    })
  })

  // https://github.com/nuxt/nuxt/issues/35341
  it('accepts MaybeRefOrGetter for documented option fields', () => {
    const method = ref<'POST'>('POST')
    const base = ref('/api')
    const search = ref('x')
    const state = reactive({ name: 'a' })

    for (const useFn of [useFetch, useLazyFetch]) {
      useFn('/api/hello', {
        method,
        baseURL: base,
        query: { q: search },
        headers: { 'x-test': search },
        body: state,
      })
      useFn('/api/hello', {
        method: computed(() => method.value),
        baseURL: computed(() => base.value),
        query: computed(() => ({ q: search.value })),
        headers: computed(() => ({ 'x-test': search.value })),
        body: computed(() => ({ ...state })),
      })
      useFn('/api/hello', {
        method: () => method.value,
        baseURL: () => base.value,
        query: () => ({ q: search.value }),
        headers: () => ({ 'x-test': search.value }),
        body: () => ({ ...state }),
      })
    }

    // @ts-expect-error wrong shape: number is not a method
    useFetch('/x', { method: 123 })
    // @ts-expect-error wrong shape: getter must return a method
    useFetch('/x', { method: () => 123 })
  })
})

describe('API route request shapes', () => {
  type IsAny<T> = 0 extends 1 & T ? true : false
  type OptionsFor<R extends string, M extends import('nuxt/app').AnyServerRouteMethod = 'get'> = import('nuxt/app').TypedFetchOptions<R, M>

  type AugmentedBody = NonNullable<OptionsFor<'/api/augmented-request', 'post'>['body']>
  type AugmentedQuery = NonNullable<OptionsFor<'/api/augmented-request', 'post'>['query']>
  type AugmentedHeaders = NonNullable<OptionsFor<'/api/augmented-request', 'post'>['headers']>

  it('types the body a route declares', () => {
    expectTypeOf<IsAny<AugmentedBody>>().toEqualTypeOf<false>()
    expectTypeOf<{ title: string }>().toExtend<AugmentedBody>()

    $fetch('/api/augmented-request', { method: 'post', body: { title: 'a' } })
    $fetch('/api/augmented-request', { method: 'POST', body: { title: 'a' } })

    // @ts-expect-error `title` is not a number
    $fetch('/api/augmented-request', { method: 'post', body: { title: 1 } })
    // @ts-expect-error `title` is missing
    $fetch('/api/augmented-request', { method: 'post', body: {} })
    // @ts-expect-error a declared body cannot be sent as a raw string
    $fetch('/api/augmented-request', { method: 'post', body: 'nope' })
    // @ts-expect-error the route declares a body, so it cannot be omitted
    $fetch('/api/augmented-request', { method: 'post' })
  })

  it('types the query and headers a route declares', () => {
    expectTypeOf<IsAny<AugmentedQuery>>().toEqualTypeOf<false>()
    expectTypeOf<IsAny<AugmentedHeaders>>().toEqualTypeOf<false>()

    $fetch('/api/augmented-request', {
      method: 'post',
      body: { title: 'a' },
      query: { page: '2' },
      headers: { 'x-token': 'a', 'x-extra': 'b' },
    })

    // @ts-expect-error `page` is not a number
    $fetch('/api/augmented-request', { method: 'post', body: { title: 'a' }, query: { page: 2 } })
    // @ts-expect-error `x-token` is not a number
    $fetch('/api/augmented-request', { method: 'post', body: { title: 'a' }, headers: { 'x-token': 2 } })
  })

  it('types the body a route declares through `useFetch`', () => {
    const title = ref('a')

    expectTypeOf(useFetch('/api/augmented-request', { method: 'post', body: { title: 'a' } }).data).toEqualTypeOf<Ref<{ created: true } | DefaultAsyncDataValue>>()
    useFetch('/api/augmented-request', { method: 'post', body: ref({ title: 'a' }) })
    useFetch('/api/augmented-request', { method: 'post', body: () => ({ title: 'a' }) })
    useFetch('/api/augmented-request', { method: 'post', body: { title } })
    useLazyFetch('/api/augmented-request', { method: 'post', body: { title: 'a' } })

    // @ts-expect-error `title` is not a number
    useFetch('/api/augmented-request', { method: 'post', body: { title: 1 } })
    // @ts-expect-error `title` is not a number, even behind a getter
    useFetch('/api/augmented-request', { method: 'post', body: () => ({ title: 1 }) })

    // @ts-expect-error the route declares a body, so it cannot be omitted
    useFetch('/api/augmented-request', { method: 'post' })
    // @ts-expect-error the route declares a body, so it cannot be omitted
    useLazyFetch('/api/augmented-request', { method: 'post' })
  })

  it('leaves a route as permissive as ofetch where any of its methods declares nothing', () => {
    // the options are checked against every method the route registers, so one that declares no
    // body is enough for the option to keep accepting anything
    $fetch('/api/augmented-mixed', { method: 'post', body: { title: 'a' } })
    // narrowed by the method the call passes: POST declares a body, so it is typed and required
    // @ts-expect-error POST declares `{ title: string }`
    $fetch('/api/augmented-mixed', { method: 'post', body: 'a raw string' })
    // @ts-expect-error POST declares a body, so it cannot be omitted
    $fetch('/api/augmented-mixed', { method: 'post' })
    $fetch('/api/augmented-mixed', { method: 'post', body: { title: 'a' } })
    // GET declares nothing, so it stays as permissive as ofetch
    $fetch('/api/augmented-mixed', { body: 'a raw string' })
  })

  it('leaves routes that validate nothing as permissive as ofetch', () => {
    $fetch('/api/hello', { body: { anything: true }, query: { page: 2 }, headers: { 'x-foo': 'bar' } })
    $fetch('/api/hey', { method: 'post', body: 'a raw string' })
    $fetch('/api/hey', { method: 'post', body: new FormData() })
    $fetch('/api/hello', { method: 'PATCH', body: { anything: true } })
    $fetch<TestResponse>('/api/hello', { method: 'post', body: { anything: true } })
    useFetch('/api/hey', { method: 'post', body: { anything: true } })
  })

  it('types the body a validating handler declares', () => {
    type ValidatedBody = NonNullable<OptionsFor<'/api/validated', 'post'>['body']>
    expectTypeOf<IsAny<ValidatedBody>>().toEqualTypeOf<false>()
    expectTypeOf<{ title: string, count: number }>().toExtend<ValidatedBody>()

    $fetch('/api/validated', { method: 'post', body: { title: 'a', count: 1 } })
    useFetch('/api/validated', { method: 'post', body: { title: 'a', count: 1 } })
    // @ts-expect-error `count` is not a string
    $fetch('/api/validated', { method: 'post', body: { title: 'a', count: 'one' } })
    // @ts-expect-error the route declares a body, so it cannot be omitted
    $fetch('/api/validated', { method: 'post' })
    // @ts-expect-error the route declares a body, so it cannot be omitted
    useFetch('/api/validated', { method: 'post' })

    // `defineValidatedHandler` returns a handler whose type drops the query it validated and
    // exposes validated headers only as a `Headers` instance, so neither can be read back from it.
    // Enable once https://github.com/h3js/h3/pull/1538 ships.
    $fetch('/api/validated', { method: 'post', body: { title: 'a', count: 1 }, query: { page: 2 }, headers: { 'x-anything': 'b' } })
  })
})

describe('nitro compatible APIs', () => {
  it('useRuntimeConfig', () => {
    useRuntimeConfig()
  })
})

describe('aliases', () => {
  it('allows importing from path aliases', () => {
    expectTypeOf(useRouter).toEqualTypeOf<typeof vueUseRouter>()
    expectTypeOf(isVue3).toEqualTypeOf<boolean>()
  })
})

describe('import meta', () => {
  it('types envName', () => {
    expectTypeOf(import.meta.envName).toEqualTypeOf<string>()
  })
})

describe('errors', () => {
  it('is throwable, so `only-throw-error` is satisfied', () => {
    const error: Error = createError({ status: 404 })
    expectTypeOf(error).toExtend<Error>()
  })
})

describe('middleware', () => {
  it('recognizes named middleware', () => {
    definePageMeta({ middleware: 'named' })
    // provided by layer
    definePageMeta({ middleware: 'override' })
    definePageMeta({ middleware: 'foo' })
    // @ts-expect-error ignore global middleware
    definePageMeta({ middleware: 'global' })
    // @ts-expect-error Invalid middleware
    definePageMeta({ middleware: 'nonexistent' })
  })
  it('types routeRules', () => {
    defineNuxtConfig({
      routeRules: {
        // @ts-expect-error Invalid middleware
        '/nonexistent': { appMiddleware: 'nonexistent' },
        // @ts-expect-error ignore global middleware
        '/global': { appMiddleware: 'global' },
        '/named': { appMiddleware: 'named' },
      },
    })
  })
  it('handles adding middleware', () => {
    addRouteMiddleware('example', (to, from) => {
      expectTypeOf(to).toEqualTypeOf<RouteLocationNormalized>()
      expectTypeOf(from).toEqualTypeOf<RouteLocationNormalized>()
      expectTypeOf(navigateTo).toEqualTypeOf<(to: RouteLocationRaw | null | undefined, options?: NavigateToOptions) => RouteLocationRaw | void | false | Promise<void | NavigationFailure | false>>()
      navigateTo('/')
      abortNavigation()
      abortNavigation('error string')
      abortNavigation(new Error('my error'))
      // @ts-expect-error Must return error or string
      abortNavigation(true)
    }, { global: true })
  })
  it('handles return types of validate', () => {
    definePageMeta({
      validate: async () => {
        await new Promise(resolve => setTimeout(resolve, 1000))
        // eslint-disable-next-line no-constant-condition
        if (0) {
          return createError({
            status: 404,
            statusText: 'resource-type-not-found',
          })
        }
        return true
      },
    })
  })
})

describe('typed router integration', () => {
  it('allows typing useRouter', () => {
    const router = useRouter()
    // @ts-expect-error this named route does not exist
    router.push({ name: 'some-thing' })
    // this one does
    router.push({ name: 'page' })
    // @ts-expect-error this is an invalid param
    router.push({ name: 'param-id', params: { bob: 23 } })
    router.push({ name: 'param-id', params: { id: 4 } })
    // @ts-expect-error this is an invalid route
    router.push({ name: 'param' })
    // @ts-expect-error this is an invalid route
    router.push({ name: '/param' })
  })

  it('correctly reads custom names typed in `definePageMeta`', () => {
    const router = useRouter()
    router.push({ name: 'some-custom-name' })
    router.push({ name: 'param-id-view-custom', params: { id: 4 } })
  })

  it('allows typing useRoute', () => {
    const route = useRoute('param-id')
    // @ts-expect-error this param does not exist
    const _invalid = route.params.something
    // this param does
    const _valid = route.params.id
  })

  it('allows typing navigateTo', () => {
    // @ts-expect-error this named route does not exist
    navigateTo({ name: 'some-thing' })
    // this one does
    navigateTo({ name: 'page' })
    // @ts-expect-error this is an invalid param
    navigateTo({ name: 'param-id', params: { bob: 23 } })
    navigateTo({ name: 'param-id', params: { id: 4 } })
    // @ts-expect-error this is an invalid param
    navigateTo({ name: 'param-id-view-custom', params: { bob: 23 } })
    navigateTo({ name: 'param-id-view-custom', params: { id: 4 } })
  })

  it('allows typing middleware', () => {
    defineNuxtRouteMiddleware((to) => {
      expectTypeOf(to.name).not.toBeAny()
      // @ts-expect-error this route does not exist
      expectTypeOf(to.name === 'bob').toEqualTypeOf<boolean>()
      expectTypeOf(to.name === 'page').toEqualTypeOf<boolean>()
    })
  })

  it('respects pages:extend augmentation', () => {
    // added via pages:extend
    expectTypeOf(useRoute().name === 'internal-async-parent').toEqualTypeOf<boolean>()
    // @ts-expect-error this route does not exist
    expectTypeOf(useRoute().name === 'invalid').toEqualTypeOf<boolean>()
  })

  it('respects pages added via layer', () => {
    expectTypeOf(useRoute().name === 'override').toEqualTypeOf<boolean>()
  })

  it('allows typing NuxtLink', () => {
    // @ts-expect-error this named route does not exist
    h(NuxtLink, { to: { name: 'some-thing' } })
    // @ts-expect-error this named route does not exist
    h(NuxtLink, { href: { name: 'some-thing' } })
    // this one does
    h(NuxtLink, { to: { name: 'page' } })
    h(NuxtLink, { href: { name: 'page' } })
    // @ts-expect-error this is an invalid param
    h(NuxtLink, { to: { name: 'param-id', params: { bob: 23 } } })
    // @ts-expect-error this is an invalid param
    h(NuxtLink, { href: { name: 'param-id', params: { bob: 23 } } })
    h(NuxtLink, { to: { name: 'param-id', params: { id: 4 } } })
    h(NuxtLink, { href: { name: 'param-id', params: { id: 4 } } })

    // doesn't throw an error when accessing properties of component
    const _props = NuxtLink.props
  })

  it('types NuxtLink slot props', () => {
    type DefaultSlotProps = Parameters<NonNullable<InstanceType<typeof NuxtLink<false>>['$slots']['default']>>[0]
    expectTypeOf<DefaultSlotProps['href']>().toEqualTypeOf<string>()
    expectTypeOf<DefaultSlotProps['isActive']>().toEqualTypeOf<boolean>()
    // @ts-expect-error prefetch state is only exposed to `custom` links
    expectTypeOf<DefaultSlotProps['prefetched']>().toEqualTypeOf<boolean>()

    type CustomSlotProps = Parameters<NonNullable<InstanceType<typeof NuxtLink<true>>['$slots']['default']>>[0]
    expectTypeOf<CustomSlotProps['href']>().toEqualTypeOf<string | null>()
    expectTypeOf<CustomSlotProps['isActive']>().toEqualTypeOf<boolean>()
    expectTypeOf<CustomSlotProps['isExternal']>().toEqualTypeOf<boolean>()
    expectTypeOf<CustomSlotProps['prefetched']>().toEqualTypeOf<boolean>()
    expectTypeOf<CustomSlotProps['route']>().toExtend<{ href: string } | undefined>()
  })

  // `vue-component-type-helpers` and Vue Language Tools both infer against a construct signature,
  // and inference against a solely generic construct signature resolves to the empty fallback
  it('exposes props and slots to structural component type inference', () => {
    type Props<T> = T extends new (...args: any) => { $props: infer P } ? NonNullable<P> : Record<never, never>
    type Slots<T> = T extends new (...args: any) => { $slots: infer S } ? NonNullable<S> : Record<never, never>
    expectTypeOf<'to' | 'href' | 'custom'>().toExtend<keyof Props<typeof NuxtLink>>()
    expectTypeOf<'default'>().toExtend<keyof Slots<typeof NuxtLink>>()
  })
})

describe('layouts', () => {
  it('definePageMeta recognizes named layouts', () => {
    definePageMeta({ layout: 'custom' })
    definePageMeta({ layout: 'pascal-case' })
    definePageMeta({ layout: 'override' })
    // @ts-expect-error Invalid layout
    definePageMeta({ layout: 'invalid-layout' })
  })

  it('NuxtLayout recognizes named layouts', () => {
    h(NuxtLayout, { name: 'custom' })
    // @ts-expect-error Invalid layout
    h(NuxtLayout, { name: 'invalid-layout' })

    h(NuxtLayout, { fallback: 'custom' })
    // @ts-expect-error Invalid layout
    h(NuxtLayout, { fallback: 'invalid-layout' })
  })

  it('setPageLayout recognizes named layouts and props', () => {
    setPageLayout('custom')
    setPageLayout('pascal-case')
    setPageLayout('override')
    setPageLayout('with-props', { aProp: 42 })
    // @ts-expect-error Invalid layout
    setPageLayout('invalid-layout')
    // @ts-expect-error Invalid layout props
    setPageLayout('with-props', { aProp: 'string-instead-of-number' })
  })

  it('expect setPageLayout to raise TS error when using non-serializable props values', () => {
    // @ts-expect-error Non-serializable layout props
    setPageLayout('withFunction', { aProp: () => {}, someProp: 5 })
  })
})

describe('nuxtApp', () => {
  it('types injections provided by plugins', () => {
    expectTypeOf(useNuxtApp().$pluginInjection).toEqualTypeOf<() => ''>()
    expectTypeOf(useNuxtApp().$foo).toEqualTypeOf<() => 'String generated from foo plugin!'>()
    expectTypeOf(useNuxtApp().$router).toEqualTypeOf<Router>()
  })
  it('marks unknown injections as unknown', () => {
    expectTypeOf(useNuxtApp().doesNotExist).toEqualTypeOf<unknown>()
    expectTypeOf(useNuxtApp().$random).toEqualTypeOf<unknown>()
  })
})

describe('plugins', () => {
  it('dependsOn is strongly typed', () => {
    defineNuxtPlugin({
      // @ts-expect-error invalid plugin name
      dependsOn: ['something'],
    })
    defineNuxtPlugin({
      dependsOn: ['nuxt:router'],
    })
  })
})

describe('runtimeConfig', () => {
  it('generated runtimeConfig types', () => {
    const runtimeConfig = useRuntimeConfig()
    expectTypeOf(runtimeConfig.public.testConfig).toEqualTypeOf<number>()
    expectTypeOf(runtimeConfig.public.needsFallback).toEqualTypeOf<string>()
    expectTypeOf(runtimeConfig.privateConfig).toEqualTypeOf<string>()
    expectTypeOf(runtimeConfig.public.ids).toEqualTypeOf<(1 | 2 | 3)[]>()
    expectTypeOf(runtimeConfig.unknown).toEqualTypeOf<unknown>()

    const injectedConfig = useNuxtApp().$config
    expectTypeOf(injectedConfig.public.testConfig).toEqualTypeOf<number>()
    expectTypeOf(injectedConfig.public.needsFallback).toEqualTypeOf<string>()
    expectTypeOf(injectedConfig.privateConfig).toEqualTypeOf<string>()
    expectTypeOf(injectedConfig.public.ids).toEqualTypeOf<(1 | 2 | 3)[]>()
    expectTypeOf(injectedConfig.unknown).toEqualTypeOf<unknown>()
  })

  it('reaches the payload and SSR context types', () => {
    const payloadConfig = useNuxtApp().payload.config!
    expectTypeOf(payloadConfig.public.ids).toEqualTypeOf<(1 | 2 | 3)[]>()
    expectTypeOf(payloadConfig.public.testConfig).toEqualTypeOf<number>()
    expectTypeOf<NonNullable<NuxtSSRContext['runtimeConfig']>['public']['ids']>().toEqualTypeOf<(1 | 2 | 3)[]>()
  })
})

describe('head', () => {
  it('types useHead', () => {
    useHead({
      base: { href: '/base' },
      link: computed(() => []),
      meta: [
        { key: 'key', name: 'description', content: 'some description ' },
        () => ({ key: 'key', name: 'description', content: 'some description ' }),
      ],
      titleTemplate: (titleChunk) => {
        return titleChunk ? `${titleChunk} - Site Title` : 'Site Title'
      },
    })
  })
  it('types head for defineNuxtComponent', () => {
    defineNuxtComponent({
      head (nuxtApp) {
        expectTypeOf(nuxtApp).not.toBeAny()
        return {
          title: 'Site Title',
        }
      },
    })

    defineNuxtComponent({
      // @ts-expect-error wrong return type for head function
      head () {
        return {
          test: true,
        }
      },
    })
  })
})

describe('components', () => {
  it('includes types for NuxtPage', () => {
    expectTypeOf(NuxtPage).not.toBeAny()
  })

  it('includes types for other components', () => {
    h(WithTypes)
    // @ts-expect-error wrong prop type for this component
    h(WithTypes, { aProp: '40' })

    // TODO: assert typed slots, exposed, generics, etc.
  })

  it('correctly includes event types with island components', () => {
    const Comp = defineComponent({
      __typeProps: {} as {
        onClick: (foo: string) => any
      },
    })
    const IslandComp = Comp as unknown as IslandComponent<typeof Comp>
    h(IslandComp, {
      // @ts-expect-error: foo must be string, not number
      onClick: (foo: number) => foo,
    })
    h(IslandComp, {
      onClick: (foo) => {
        foo satisfies string
        return foo
      },
    })
  })

  it('correctly includes event types with lazy components', () => {
    const Comp = defineComponent({
      __typeProps: {} as {
        onClick: (foo: string) => any
      },
    })
    const LazyComp = Comp as unknown as LazyComponent<typeof Comp>
    h(LazyComp, {
      // @ts-expect-error: foo must be string, not number
      onClick: (foo: number) => foo,
    })
    h(LazyComp, {
      onClick: (foo) => {
        foo satisfies string
        return foo
      },
    })
  })

  it('includes types for lazy hydration', () => {
    h(LazyWithTypes)
    h(LazyWithTypes, { hydrateAfter: 300 })
    h(LazyWithTypes, { hydrateOnIdle: true })

    // @ts-expect-error wrong prop type for this hydration strategy
    h(LazyWithTypes, { hydrateAfter: '' })
  })

  it('include fallback slot in server components', () => {
    expectTypeOf(ServerComponent.slots).toEqualTypeOf<SlotsType<{ fallback: { error: unknown } }> | undefined>()
  })

  it('types preloadComponents/prefetchComponents against global component names', () => {
    expectTypeOf(preloadComponents).parameter(0).toEqualTypeOf<'GlobalComponent' | 'LazyGlobalComponent' | Array<'GlobalComponent' | 'LazyGlobalComponent'>>()
    expectTypeOf(prefetchComponents).parameter(0).toEqualTypeOf<'GlobalComponent' | 'LazyGlobalComponent' | Array<'GlobalComponent' | 'LazyGlobalComponent'>>()
    // @ts-expect-error not a global component
    void preloadComponents('WithTypes')
  })

  it('types NuxtIsland name against island component names', () => {
    h(NuxtIsland, { name: 'ServerComponent' })
    // @ts-expect-error not an island component
    h(NuxtIsland, { name: 'WithTypes' })
  })
})

describe('composables', () => {
  it('allows providing default refs', () => {
    expectTypeOf(useState('test', () => ref('hello'))).toEqualTypeOf<Ref<string>>()
    expectTypeOf(useState('test', () => 'hello')).toEqualTypeOf<Ref<string>>()

    expectTypeOf(useCookie('test', { default: () => ref(500) })).toEqualTypeOf<Ref<number>>()
    expectTypeOf(useCookie('test', { default: () => 500 })).toEqualTypeOf<Ref<number>>()
    useCookie<number | null>('test').value = null

    expectTypeOf(useAsyncData('test', () => Promise.resolve(500), { default: () => ref(500) }).data).toEqualTypeOf<Ref<number>>()
    expectTypeOf(useAsyncData('test', () => Promise.resolve(500), { default: () => 500 }).data).toEqualTypeOf<Ref<number>>()
    expectTypeOf(useAsyncData('test', () => Promise.resolve('500'), { default: () => ref(500) }).data).toEqualTypeOf<Ref<string | number>>()
    expectTypeOf(useAsyncData('test', () => Promise.resolve('500'), { default: () => 500 }).data).toEqualTypeOf<Ref<string | number>>()

    expectTypeOf(useFetch('/api/hello', { default: () => ref(500) }).data).toEqualTypeOf<Ref<string | number>>()
    expectTypeOf(useFetch('/api/hello', { default: () => 500 }).data).toEqualTypeOf<Ref<string | number>>()
  })

  it('enforces readonly cookies', () => {
    // @ts-expect-error readonly cookie
    useCookie('test', { readonly: true }).value = 'thing'
  })

  it('correct types when using ResT type-assertion with default function', () => {
    // @ts-expect-error default type should match generic type
    useFetch<string>('/api/hello', { default: () => 0 })
    // @ts-expect-error default type should match generic type
    useLazyFetch<string>('/api/hello', { default: () => 0 })
    // @ts-expect-error default type should match generic type
    useAsyncData<string>(() => $fetch('/api/hello'), { default: () => 0 })
    // @ts-expect-error default type should match generic type
    useLazyAsyncData<string>(() => $fetch('/api/hello'), { default: () => 0 })

    expectTypeOf(useFetch<string>('/api/hello', { default: () => 'test' }).data).toEqualTypeOf<Ref<string>>()
    expectTypeOf(useLazyFetch<string>('/api/hello', { default: () => 'test' }).data).toEqualTypeOf<Ref<string>>()
    expectTypeOf(useAsyncData<string>(() => $fetch('/api/hello'), { default: () => 'test' }).data).toEqualTypeOf<Ref<string>>()
    expectTypeOf(useLazyAsyncData<string>(() => $fetch('/api/hello'), { default: () => 'test' }).data).toEqualTypeOf<Ref<string>>()

    // transform must match the explicit generic because of typescript limitations microsoft/TypeScript#14400
    expectTypeOf(useFetch<string>('/api/hello', { transform: () => 'transformed' }).data).toEqualTypeOf<Ref<string | DefaultAsyncDataValue>>()
    expectTypeOf(useLazyFetch<string>('/api/hello', { transform: () => 'transformed' }).data).toEqualTypeOf<Ref<string | DefaultAsyncDataValue>>()
    expectTypeOf(useAsyncData<string>(() => $fetch('/api/hello'), { transform: () => 'transformed' }).data).toEqualTypeOf<Ref<string | DefaultAsyncDataValue>>()
    expectTypeOf(useLazyAsyncData<string>(() => $fetch('/api/hello'), { transform: () => 'transformed' }).data).toEqualTypeOf<Ref<string | DefaultAsyncDataValue>>()

    expectTypeOf(useFetch<string>('/api/hello', { default: () => 'test', transform: () => 'transformed' }).data).toEqualTypeOf<Ref<string>>()
    expectTypeOf(useLazyFetch<string>('/api/hello', { default: () => 'test', transform: () => 'transformed' }).data).toEqualTypeOf<Ref<string>>()
    expectTypeOf(useAsyncData<string>(() => $fetch('/api/hello'), { default: () => 'test', transform: () => 'transformed' }).data).toEqualTypeOf<Ref<string>>()
    expectTypeOf(useLazyAsyncData<string>(() => $fetch('/api/hello'), { default: () => 'test', transform: () => 'transformed' }).data).toEqualTypeOf<Ref<string>>()
  })

  it('supports asynchronous transform', () => {
    const { data } = useAsyncData('test', () => $fetch('/api/hello') as Promise<{ foo: 'bar' }>, {
      async transform (data) {
        await Promise.resolve()
        return data.foo
      },
    })
    expectTypeOf(data).toEqualTypeOf<Ref<'bar' | DefaultAsyncDataValue>>()
  })

  it('infer request url string literal from server/api routes', () => {
    // request can accept dynamic string type
    const dynamicStringUrl = 'https://example.com/api'
    expectTypeOf(useFetch(dynamicStringUrl).data).toEqualTypeOf<Ref<unknown>>()

    // TODO: as above, blocked on handler return types resolving in this program
    // request param should infer string literal type / show auto-complete hint base on server routes, ex: '/api/hello'
    // expectTypeOf(useFetch('/api/hello').data).toEqualTypeOf<Ref<string | DefaultAsyncDataValue>>()
    // expectTypeOf(useLazyFetch('/api/hello').data).toEqualTypeOf<Ref<string | DefaultAsyncDataValue>>()

    // request can accept string literal and Request object type
    expectTypeOf(useFetch('https://example.com/api').data).toEqualTypeOf<Ref<unknown>>()
    expectTypeOf(useFetch(new Request('test')).data).toEqualTypeOf<Ref<unknown>>()
  })

  it('provides proper type support when using overloads', () => {
    expectTypeOf(useState('test')).toEqualTypeOf(useState())
    expectTypeOf(useState('test', () => ({ foo: Math.random() }))).toEqualTypeOf(useState(() => ({ foo: Math.random() })))

    expectTypeOf(useAsyncData(computed(() => 'test'), () => Promise.resolve({ foo: Math.random() })))
      .toEqualTypeOf(useAsyncData(() => Promise.resolve({ foo: Math.random() })))
    expectTypeOf(useAsyncData(computed(() => 'test'), () => Promise.resolve({ foo: Math.random() }), { transform: data => data.foo }))
      .toEqualTypeOf(useAsyncData(() => Promise.resolve({ foo: Math.random() }), { transform: data => data.foo }))

    expectTypeOf(useLazyAsyncData(computed(() => 'test'), () => Promise.resolve({ foo: Math.random() })))
      .toEqualTypeOf(useLazyAsyncData(() => Promise.resolve({ foo: Math.random() })))
    expectTypeOf(useLazyAsyncData(computed(() => 'test'), () => Promise.resolve({ foo: Math.random() }), { transform: data => data.foo }))
      .toEqualTypeOf(useLazyAsyncData(() => Promise.resolve({ foo: Math.random() }), { transform: data => data.foo }))

    expectTypeOf(useAsyncData('test', () => Promise.resolve({ foo: Math.random() })))
      .toEqualTypeOf(useAsyncData(() => Promise.resolve({ foo: Math.random() })))
    expectTypeOf(useAsyncData('test', () => Promise.resolve({ foo: Math.random() }), { transform: data => data.foo }))
      .toEqualTypeOf(useAsyncData(() => Promise.resolve({ foo: Math.random() }), { transform: data => data.foo }))

    expectTypeOf(useLazyAsyncData('test', () => Promise.resolve({ foo: Math.random() })))
      .toEqualTypeOf(useLazyAsyncData(() => Promise.resolve({ foo: Math.random() })))
    expectTypeOf(useLazyAsyncData('test', () => Promise.resolve({ foo: Math.random() }), { transform: data => data.foo }))
      .toEqualTypeOf(useLazyAsyncData(() => Promise.resolve({ foo: Math.random() }), { transform: data => data.foo }))

    // Default values: #14437
    // TODO: what?!
    expectTypeOf(useAsyncData('test', () => Promise.resolve({ foo: { bar: 500 } }), { default: () => ({ bar: 500 }), transform: v => v.foo }).data).toEqualTypeOf<Ref<{ bar: number } | { bar: number }>>()
    expectTypeOf(useLazyAsyncData('test', () => Promise.resolve({ foo: { bar: 500 } }), { default: () => ({ bar: 500 }), transform: v => v.foo }))
      .toEqualTypeOf(useLazyAsyncData(() => Promise.resolve({ foo: { bar: 500 } }), { default: () => ({ bar: 500 }), transform: v => v.foo }))
      // TODO: as above, blocked on handler return types resolving in this program
    // expectTypeOf(useFetch('/api/hey', { default: () => 1, transform: v => v.foo }).data).toEqualTypeOf<Ref<string | number>>()
    // expectTypeOf(useLazyFetch('/api/hey', { default: () => 'bar', transform: v => v.foo }).data).toEqualTypeOf<Ref<string>>()
  })

  it('uses types compatible between useRequestHeaders and useFetch', () => {
    useFetch('/api/hey', {
      headers: useRequestHeaders(),
    })
    useFetch('/api/hey', {
      headers: useRequestHeaders(['test']),
    })
    const { test } = useRequestHeaders(['test'])
    expectTypeOf(test).toEqualTypeOf<string | undefined>()
  })

  it('allows passing reactive values in useFetch', () => {
    useFetch('/api/hey', {
      headers: {
        key: ref('test'),
      },
      query: {
        param: computed(() => 'thing'),
      },
    })
  })

  it('correctly types returns with key signatures', () => {
    interface TestType {
      id: string
      content: string[]
      [x: string]: any
    }

    const testFetch = () => Promise.resolve({}) as Promise<TestType>

    const { data: notTypedData } = useAsyncData('test', testFetch)
    expectTypeOf(notTypedData.value!.id).toEqualTypeOf<string>()
    expectTypeOf(notTypedData.value!.content).toEqualTypeOf<string[]>()
    expectTypeOf(notTypedData.value!.untypedKey).toEqualTypeOf<any>()
  })

  it('correctly types returns when using with getCachedData', () => {
    expectTypeOf(useAsyncData('test', () => Promise.resolve({ foo: 1 }), {
      getCachedData: key => useNuxtApp().payload.data[key],
    }).data).toEqualTypeOf<Ref<{ foo: number } | DefaultAsyncDataValue>>()
    useAsyncData('test', () => Promise.resolve({ foo: 1 }), {
      // @ts-expect-error cached data should return the same as value of fetcher
      getCachedData: () => ({ bar: 2 }),
    })
    useAsyncData<{ foo: number }, unknown, { foo: number }>('test', () => Promise.resolve({ foo: 1 }), {
      // @ts-expect-error cached data should return the same as asserted type of `useAsyncData`
      getCachedData: () => ({ bar: 2 }),
    })
  })

  it('infers transformed data independently from typed cached data', () => {
    const asyncData = useAsyncData(
      () => Promise.resolve({
        foo: 'bar',
      }),
      {
        transform: data => data.foo,
        getCachedData: () => 'bar',
      },
    )

    expectTypeOf(asyncData.data).toEqualTypeOf<Ref<string | DefaultAsyncDataValue>>()
  })

  it('propagates factory transform type through createUseAsyncData (#35128)', () => {
    interface Foo { a: number, b: string }

    // defaults mode
    const useFooData = createUseAsyncData({
      transform: (res: Foo) => ({ count: res.a }),
    })
    const r1 = useFooData('key', () => Promise.resolve({ a: 1, b: 'x' } as Foo))
    expectTypeOf(r1.data).toEqualTypeOf<Ref<{ count: number } | DefaultAsyncDataValue>>()

    const r1NoKey = useFooData(() => Promise.resolve({ a: 1, b: 'x' } as Foo))
    expectTypeOf(r1NoKey.data).toEqualTypeOf<Ref<{ count: number } | DefaultAsyncDataValue>>()

    // override mode (function form)
    const useFooDataOverride = createUseAsyncData(() => ({
      transform: (res: Foo) => ({ count: res.a }),
    }))
    const r2 = useFooDataOverride('key', () => Promise.resolve({ a: 1, b: 'x' } as Foo))
    expectTypeOf(r2.data).toEqualTypeOf<Ref<{ count: number } | DefaultAsyncDataValue>>()

    // no factory transform: falls back to handler return type
    const useBareData = createUseAsyncData({})
    const r3 = useBareData('key', () => Promise.resolve({ a: 1, b: 'x' } as Foo))
    expectTypeOf(r3.data).toEqualTypeOf<Ref<Foo | DefaultAsyncDataValue>>()

    // caller transform still wins over factory transform default
    const r4 = useFooData('key', () => Promise.resolve({ a: 1, b: 'x' } as Foo), {
      transform: res => res.b,
    })
    expectTypeOf(r4.data).toEqualTypeOf<Ref<string | DefaultAsyncDataValue>>()
  })

  it('propagates factory transform type through createUseFetch (#35128)', () => {
    interface Foo { a: number, b: string }

    // defaults mode
    const useFooFetch = createUseFetch({
      transform: (res: Foo) => ({ count: res.a }),
    })
    const r1 = useFooFetch<Foo>('/api/foo')
    expectTypeOf(r1.data).toEqualTypeOf<Ref<{ count: number } | DefaultAsyncDataValue>>()

    // override mode (function form)
    const useFooFetchOverride = createUseFetch(() => ({
      transform: (res: Foo) => ({ count: res.a }),
    }))
    const r2 = useFooFetchOverride<Foo>('/api/foo')
    expectTypeOf(r2.data).toEqualTypeOf<Ref<{ count: number } | DefaultAsyncDataValue>>()

    // no factory transform: falls back to fetch result type
    const useBareFetch = createUseFetch({})
    const r3 = useBareFetch<Foo>('/api/foo')
    expectTypeOf(r3.data).toEqualTypeOf<Ref<Foo | DefaultAsyncDataValue>>()

    // caller transform overrides factory transform default
    // (only works without an explicit `ResT` generic, due to microsoft/TypeScript#14400)
    const r4 = useFooFetch('/api/foo', { transform: (res: Foo) => res.b })
    expectTypeOf(r4.data).toEqualTypeOf<Ref<string | DefaultAsyncDataValue>>()
  })

  it('resolves a client against the route set it declares', () => {
    interface Pet { id: number, name: string }

    /** The shape a generator would emit for a third-party API - here written by hand. */
    interface PetStore {
      '/pets': {
        [Endpoint]: {
          GET: { response: Pet[], query: { limit?: number } }
          POST: { response: Pet, body: { name: string } }
        }
        [DynamicParam]: {
          [Endpoint]: { GET: { response: Pet } }
        }
      }
    }

    const useApi = createUseFetch({ baseURL: 'https://api.example.com', routes: {} as PetStore })

    // the declared paths are the ones the API documents, matched as written: the base is transport
    expectTypeOf(useApi('/pets').data).toEqualTypeOf<Ref<Pet[] | DefaultAsyncDataValue>>()
    expectTypeOf(useApi('/pets/42').data).toEqualTypeOf<Ref<Pet | DefaultAsyncDataValue>>()
    expectTypeOf(useApi('/pets', { method: 'post', body: { name: 'Rex' } }).data).toEqualTypeOf<Ref<Pet | DefaultAsyncDataValue>>()
    expectTypeOf(useApi('/pets', { query: { limit: 2 } }).data).toEqualTypeOf<Ref<Pet[] | DefaultAsyncDataValue>>()
    expectTypeOf(useApi('/pets', { transform: pets => pets.length }).data).toEqualTypeOf<Ref<number | DefaultAsyncDataValue>>()

    // @ts-expect-error no GET route matches '/pats'
    useApi('/pats')
    // @ts-expect-error the app's own routes are not this client's
    useApi('/api/hello')
    // @ts-expect-error no PUT route matches '/pets'
    useApi('/pets', { method: 'put' })
    // @ts-expect-error the declared route validates a body, so it cannot be omitted
    useApi('/pets', { method: 'post' })
    // @ts-expect-error `name` is not a number
    useApi('/pets', { method: 'post', body: { name: 42 } })

    // a path built at runtime resolves to `unknown`, as it does against the app's own routes
    const runtime: string = '/pets'
    expectTypeOf(useApi(runtime).data).toEqualTypeOf<Ref<unknown>>()

    // and the app's own composable is unaffected by a client declaring its own set
    expectTypeOf(useFetch('/api/hello').data).toEqualTypeOf<Ref<string | DefaultAsyncDataValue>>()
  })

  it('propagates factory `default` / `pick` types through createUseAsyncData / createUseFetch (#35128)', () => {
    interface Foo { a: number, b: string }

    // createUseAsyncData: factory `default` widens the returned data type
    const useWithDefault = createUseAsyncData({ default: () => 'fallback' as const })
    const d1 = useWithDefault('k', () => Promise.resolve({ a: 1, b: 'x' } as Foo))
    expectTypeOf(d1.data.value).toEqualTypeOf<Foo | 'fallback'>()

    // factory transform + default together: data is the transform output (or factory default)
    const useWithBoth = createUseAsyncData({
      transform: (res: Foo) => ({ count: res.a }),
      default: () => ({ count: 0 }),
    })
    const d2 = useWithBoth('k', () => Promise.resolve({ a: 1, b: 'x' } as Foo))
    expectTypeOf(d2.data.value).toEqualTypeOf<{ count: number }>()

    // factory pick narrows the returned data type.
    // The factory `pick` option doesn't infer FPickKeys (array literals widen to `string[]`),
    // so the user passes it explicitly as a generic.
    const useWithPick = createUseAsyncData<Foo, Foo, ['a']>({ pick: ['a'] })
    const d3 = useWithPick('k', () => Promise.resolve({ a: 1, b: 'x' } as Foo))
    expectTypeOf(d3.data.value).toEqualTypeOf<Pick<Foo, 'a'> | undefined>()

    // createUseFetch: factory `default` widens the returned data type
    const useFetchWithDefault = createUseFetch({ default: () => 'fallback' as const })
    const f1 = useFetchWithDefault<Foo>('/api/foo')
    expectTypeOf(f1.data.value).toEqualTypeOf<Foo | 'fallback'>()

    // createUseFetch: factory transform + default
    const useFetchBoth = createUseFetch({
      transform: (res: Foo) => ({ count: res.a }),
      default: () => ({ count: 0 }),
    })
    const f2 = useFetchBoth<Foo>('/api/foo')
    expectTypeOf(f2.data.value).toEqualTypeOf<{ count: number }>()
  })
})

describe('app config', () => {
  it('merges app config as expected', () => {
    interface ExpectedMergedAppConfig {
      // eslint-disable-next-line @typescript-eslint/no-empty-object-type
      nuxt: {}
      fromLayer: boolean
      fromNuxtConfig: boolean
      nested: {
        val: number
      }
      userConfig: 123 | 456
      someThing?: {
        value?: string | false
      }
      themed: {
        colors: { primary: string, neutral: string }
        slots: { root: string, body: string }
        variants: string[]
        format: (value: string) => string
      }
      [key: string]: unknown
    }
    expectTypeOf<AppConfig>().toEqualTypeOf<ExpectedMergedAppConfig>()
  })
  it('does not recurse into function and array values', () => {
    expectTypeOf<AppConfig['themed']['format']>().toEqualTypeOf<(value: string) => string>()
    expectTypeOf<AppConfig['themed']['variants']>().toEqualTypeOf<string[]>()
  })
  it('accepts partial overrides of module-provided app config', () => {
    expectTypeOf<AppConfigInput['themed']>().toEqualTypeOf<{
      colors?: { primary?: string, neutral?: string }
      slots?: { root?: string, body?: string }
      variants?: string[]
      format?: (value: string) => string
    } | undefined>()
  })
  it('resolves the same input type through `nuxt/schema` and `@nuxt/schema`', () => {
    expectTypeOf<AppConfigInputFromNuxt['themed']>().toEqualTypeOf<AppConfigInput['themed']>()
  })
})

describe('extends type declarations', () => {
  it('correctly adds references to tsconfig', () => {
    expectTypeOf<import('bing').BingInterface>().toEqualTypeOf<{ foo: 'bar' }>()
  })
})

describe('composables inference', () => {
  it('callWithNuxt', () => {
    const bob = callWithNuxt({} as any, () => true)
    expectTypeOf<typeof bob>().toEqualTypeOf<Promise<boolean>>()
  })
  it('runWithContext', () => {
    const bob = useNuxtApp().runWithContext(() => true)
    expectTypeOf<typeof bob>().toEqualTypeOf<boolean | Promise<boolean>>()
  })
})

describe('kit utilities', () => {
  it('addTypeTemplate', () => {
    // @ts-expect-error Fromage is 'cheese'
    const _fake: Fromage = 'babybel'

    const _fromage: Fromage = 'cheese'
  })
})

declare module '#app' {
  interface NuxtApp {
    $augmentedViaPoundApp: (msg: string) => number
  }
  interface PageMeta {
    poundAppMetaField?: boolean
  }
  interface RuntimeNuxtHooks {
    'pound-app:custom-hook': (payload: { foo: string }) => void | Promise<void>
  }
}

declare module 'nuxt/app' {
  interface NuxtApp {
    $augmentedViaNuxtApp: string
  }
}

declare module '#app' {
  interface NuxtPayload {
    poundAppPayloadField?: 'from-pound-app'
  }
}

describe('module augmentation of runtime app types', () => {
  it('merges `NuxtApp` augmentations from `#app` and `nuxt/app`', () => {
    const nuxtApp = useNuxtApp()
    expectTypeOf(nuxtApp.$augmentedViaPoundApp).toEqualTypeOf<(msg: string) => number>()
    expectTypeOf(nuxtApp.$augmentedViaNuxtApp).toEqualTypeOf<string>()
  })
  it('sees the same `NuxtApp` interface through both specifiers', () => {
    const viaNuxtApp: import('nuxt/app').NuxtApp = useNuxtApp()
    expectTypeOf(viaNuxtApp.$augmentedViaPoundApp).toEqualTypeOf<(msg: string) => number>()
    expectTypeOf(viaNuxtApp.$augmentedViaNuxtApp).toEqualTypeOf<string>()
    const viaPoundApp: import('#app').NuxtApp = viaNuxtApp
    expectTypeOf(viaPoundApp).toEqualTypeOf<typeof viaNuxtApp>()
  })
  it('merges `PageMeta` augmentations from `#app`', () => {
    definePageMeta({ poundAppMetaField: true })
    expectTypeOf<PageMeta['poundAppMetaField']>().toEqualTypeOf<boolean | undefined>()
  })
  it('merges `RuntimeNuxtHooks` augmentations from `#app`', () => {
    useNuxtApp().hook('pound-app:custom-hook', (payload) => {
      expectTypeOf(payload).toEqualTypeOf<{ foo: string }>()
    })
  })
  it('re-exports the same leaf types through `#app` as `#app/types` declares', () => {
    expectTypeOf<import('#app').NuxtPayload>().toEqualTypeOf<import('#app/types').NuxtPayload>()
    expectTypeOf<import('#app').NuxtSSRContext>().toEqualTypeOf<import('#app/types').NuxtSSRContext>()
  })
  it('flows `#app` payload augmentations through to the `#app/types` leaf', () => {
    // `@nuxt/nitro-server` reads `NuxtPayload` from `#app/types`; a user
    // augmentation applied via `#app` must be visible there too.
    expectTypeOf<import('#app/types').NuxtPayload['poundAppPayloadField']>().toEqualTypeOf<'from-pound-app' | undefined>()
  })
})

describe('error typing', () => {
  it('useError exposes NuxtError fields', () => {
    const error = useError()
    expectTypeOf(error.value?.fatal).toEqualTypeOf<boolean | undefined>()
    expectTypeOf(error.value?.__nuxt_error).toEqualTypeOf<true | undefined>()
  })

  it('stays structurally compatible with the error h3 reads during SSR', () => {
    expectTypeOf<NuxtError>().toExtend<HTTPError>()
  })
})

describe('request event typing', () => {
  it('resolves the event to the one contributed by `@nuxt/nitro-server`', () => {
    expectTypeOf(useRequestEvent()).toEqualTypeOf<H3Event | undefined>()
    expectTypeOf<NuxtSSRContext['event']>().toEqualTypeOf<H3Event>()
    expectTypeOf<RequestEvent>().toEqualTypeOf<H3Event>()
  })
})

describe('route rules typing', () => {
  it('resolves the rules contributed by `@nuxt/nitro-server`', () => {
    const rules = getRouteRules(useRequestEvent()!)
    expectTypeOf(rules.redirect).toEqualTypeOf<string | undefined>()
    expectTypeOf(rules.prerender).toEqualTypeOf<boolean | undefined>()
    expectTypeOf(rules.appMiddleware).toEqualTypeOf<Record<string, boolean> | undefined>()
    expectTypeOf(rules.payload).toEqualTypeOf<boolean | undefined>()
    expectTypeOf(rules.appLayout).toEqualTypeOf<LayoutKey | false | undefined>()
    // rules the app layer does not describe are read through the index signature
    expectTypeOf(rules.swr).toBeUnknown()
    expectTypeOf(rules.headers).toBeUnknown()
  })
})
