import { expectTypeOf } from 'expect-type'
import { describe, it } from 'vitest'
import type { Ref } from 'vue'

import { NavigationFailure, RouteLocationNormalizedLoaded, RouteLocationRaw, useRouter as vueUseRouter } from 'vue-router'
import { defineNuxtConfig } from '~~/../../../packages/nuxt/src'
import { useRouter } from '#imports'
import { isVue3 } from '#app'

interface TestResponse { message: string }

describe('API routes', () => {
  it('generates types for routes', () => {
    expectTypeOf($fetch('/api/hello')).toMatchTypeOf<Promise<string>>()
    expectTypeOf($fetch('/api/hey')).toMatchTypeOf<Promise<{ foo:string, baz: string }>>()
    expectTypeOf($fetch('/api/other')).toMatchTypeOf<Promise<unknown>>()
    expectTypeOf($fetch<TestResponse>('/test')).toMatchTypeOf<Promise<TestResponse>>()
  })

  it('works with useAsyncData', () => {
    expectTypeOf(useAsyncData('api-hello', () => $fetch('/api/hello')).data).toMatchTypeOf<Ref<string>>()
    expectTypeOf(useAsyncData('api-hey', () => $fetch('/api/hey')).data).toMatchTypeOf<Ref<{ foo:string, baz: string }>>()
    expectTypeOf(useAsyncData('api-hey-with-pick', () => $fetch('/api/hey'), { pick: ['baz'] }).data).toMatchTypeOf<Ref<{ baz: string }>>()
    expectTypeOf(useAsyncData('api-other', () => $fetch('/api/other')).data).toMatchTypeOf<Ref<unknown>>()
    expectTypeOf(useAsyncData<TestResponse>('api-generics', () => $fetch('/test')).data).toMatchTypeOf<Ref<TestResponse>>()

    expectTypeOf(useAsyncData('api-error-generics', () => $fetch('/error')).error).toMatchTypeOf<Ref<Error | true | null>>()
    expectTypeOf(useAsyncData<any, string>('api-error-generics', () => $fetch('/error')).error).toMatchTypeOf<Ref<string | true | null>>()

    expectTypeOf(useLazyAsyncData('lazy-api-hello', () => $fetch('/api/hello')).data).toMatchTypeOf<Ref<string>>()
    expectTypeOf(useLazyAsyncData('lazy-api-hey', () => $fetch('/api/hey')).data).toMatchTypeOf<Ref<{ foo:string, baz: string }>>()
    expectTypeOf(useLazyAsyncData('lazy-api-hey-with-pick', () => $fetch('/api/hey'), { pick: ['baz'] }).data).toMatchTypeOf<Ref<{ baz: string }>>()
    expectTypeOf(useLazyAsyncData('lazy-api-other', () => $fetch('/api/other')).data).toMatchTypeOf<Ref<unknown>>()
    expectTypeOf(useLazyAsyncData<TestResponse>('lazy-api-generics', () => $fetch('/test')).data).toMatchTypeOf<Ref<TestResponse>>()

    expectTypeOf(useLazyAsyncData('lazy-error-generics', () => $fetch('/error')).error).toMatchTypeOf<Ref<Error | true | null>>()
    expectTypeOf(useLazyAsyncData<any, string>('lazy-error-generics', () => $fetch('/error')).error).toMatchTypeOf<Ref<string | true | null>>()
  })

  it('works with useFetch', () => {
    expectTypeOf(useFetch('/api/hello').data).toMatchTypeOf<Ref<string>>()
    expectTypeOf(useFetch('/api/hey').data).toMatchTypeOf<Ref<{ foo:string, baz: string }>>()
    expectTypeOf(useFetch('/api/hey', { pick: ['baz'] }).data).toMatchTypeOf<Ref<{ baz: string }>>()
    expectTypeOf(useFetch('/api/other').data).toMatchTypeOf<Ref<unknown>>()
    expectTypeOf(useFetch<TestResponse>('/test').data).toMatchTypeOf<Ref<TestResponse>>()

    expectTypeOf(useFetch('/error').error).toMatchTypeOf<Ref<Error | null | true>>()
    expectTypeOf(useFetch<any, string>('/error').error).toMatchTypeOf<Ref<string | null | true>>()

    expectTypeOf(useLazyFetch('/api/hello').data).toMatchTypeOf<Ref<string>>()
    expectTypeOf(useLazyFetch('/api/hey').data).toMatchTypeOf<Ref<{ foo:string, baz: string }>>()
    expectTypeOf(useLazyFetch('/api/hey', { pick: ['baz'] }).data).toMatchTypeOf<Ref<{ baz: string }>>()
    expectTypeOf(useLazyFetch('/api/other').data).toMatchTypeOf<Ref<unknown>>()
    expectTypeOf(useLazyFetch('/api/other').data).toMatchTypeOf<Ref<unknown>>()
    expectTypeOf(useLazyFetch<TestResponse>('/test').data).toMatchTypeOf<Ref<TestResponse>>()

    expectTypeOf(useLazyFetch('/error').error).toMatchTypeOf<Ref<Error | null | true>>()
    expectTypeOf(useLazyFetch<any, string>('/error').error).toMatchTypeOf<Ref<string | null | true>>()
  })
})

describe('aliases', () => {
  it('allows importing from path aliases', () => {
    expectTypeOf(useRouter).toMatchTypeOf<typeof vueUseRouter>()
    expectTypeOf(isVue3).toMatchTypeOf<boolean>()
  })
})

describe('middleware', () => {
  it('recognizes named middleware', () => {
    definePageMeta({ middleware: 'inject-auth' })
    // @ts-expect-error ignore global middleware
    definePageMeta({ middleware: 'redirect' })
    // @ts-expect-error Invalid middleware
    definePageMeta({ middleware: 'invalid-middleware' })
  })
  it('handles adding middleware', () => {
    addRouteMiddleware('example', (to, from) => {
      expectTypeOf(to).toMatchTypeOf<RouteLocationNormalizedLoaded>()
      expectTypeOf(from).toMatchTypeOf<RouteLocationNormalizedLoaded>()
      expectTypeOf(navigateTo).toMatchTypeOf<(to: RouteLocationRaw) => RouteLocationRaw | Promise<void | NavigationFailure>>()
      navigateTo('/')
      abortNavigation()
      abortNavigation('error string')
      abortNavigation(new Error('my error'))
      // @ts-expect-error Must return error or string
      abortNavigation(true)
    }, { global: true })
  })
})

describe('layouts', () => {
  it('recognizes named layouts', () => {
    definePageMeta({ layout: 'custom' })
    definePageMeta({ layout: 'pascal-case' })
    // @ts-expect-error Invalid layout
    definePageMeta({ layout: 'invalid-layout' })
  })
})

describe('modules', () => {
  it('augments schema automatically', () => {
    defineNuxtConfig({ sampleModule: { enabled: false } })
    // @ts-expect-error
    defineNuxtConfig({ sampleModule: { other: false } })
    defineNuxtConfig({ undeclaredKey: { other: false } })
  })
})

describe('runtimeConfig', () => {
  it('generated runtimeConfig types', () => {
    const runtimeConfig = useRuntimeConfig()
    expectTypeOf(runtimeConfig.testConfig).toMatchTypeOf<number>()
    expectTypeOf(runtimeConfig.privateConfig).toMatchTypeOf<string>()
    expectTypeOf(runtimeConfig.unknown).toMatchTypeOf<any>()
  })
})

describe('composables', () => {
  it('allows providing default refs', () => {
    expectTypeOf(useState('test', () => ref('hello'))).toMatchTypeOf<Ref<string>>()
    expectTypeOf(useState('test', () => 'hello')).toMatchTypeOf<Ref<string>>()

    expectTypeOf(useCookie('test', { default: () => ref(500) })).toMatchTypeOf<Ref<number>>()
    expectTypeOf(useCookie('test', { default: () => 500 })).toMatchTypeOf<Ref<number>>()

    expectTypeOf(useAsyncData('test', () => Promise.resolve(500), { default: () => ref(500) }).data).toMatchTypeOf<Ref<number>>()
    expectTypeOf(useAsyncData('test', () => Promise.resolve(500), { default: () => 500 }).data).toMatchTypeOf<Ref<number>>()
    // @ts-expect-error
    expectTypeOf(useAsyncData('test', () => Promise.resolve('500'), { default: () => ref(500) }).data).toMatchTypeOf<Ref<number>>()
    // @ts-expect-error
    expectTypeOf(useAsyncData('test', () => Promise.resolve('500'), { default: () => 500 }).data).toMatchTypeOf<Ref<number>>()

    expectTypeOf(useFetch('/test', { default: () => ref(500) }).data).toMatchTypeOf<Ref<number>>()
    expectTypeOf(useFetch('/test', { default: () => 500 }).data).toMatchTypeOf<Ref<number>>()
  })

  it('provides proper type support when using overloads', () => {
    expectTypeOf(useState('test')).toMatchTypeOf(useState())
    expectTypeOf(useState('test', () => ({ foo: Math.random() }))).toMatchTypeOf(useState(() => ({ foo: Math.random() })))

    expectTypeOf(useAsyncData('test', () => Promise.resolve({ foo: Math.random() })))
      .toMatchTypeOf(useAsyncData(() => Promise.resolve({ foo: Math.random() })))
    expectTypeOf(useAsyncData('test', () => Promise.resolve({ foo: Math.random() }), { transform: data => data.foo }))
      .toMatchTypeOf(useAsyncData(() => Promise.resolve({ foo: Math.random() }), { transform: data => data.foo }))

    expectTypeOf(useLazyAsyncData('test', () => Promise.resolve({ foo: Math.random() })))
      .toMatchTypeOf(useLazyAsyncData(() => Promise.resolve({ foo: Math.random() })))
    expectTypeOf(useLazyAsyncData('test', () => Promise.resolve({ foo: Math.random() }), { transform: data => data.foo }))
      .toMatchTypeOf(useLazyAsyncData(() => Promise.resolve({ foo: Math.random() }), { transform: data => data.foo }))
  })
})
