import { expectTypeOf } from 'expect-type'
import { describe, it } from 'vitest'
import type { Ref } from 'vue'
import type { AppConfig } from '@nuxt/schema'

import type { FetchError } from 'ofetch'
import { NavigationFailure, RouteLocationNormalizedLoaded, RouteLocationRaw, useRouter as vueUseRouter } from 'vue-router'
import type { NavigateToOptions } from '~~/../../../packages/nuxt/dist/app/composables/router'
// eslint-disable-next-line import/order
import { isVue3 } from '#app'
import { defineNuxtConfig } from '~~/../../../packages/nuxt/config'
import { useRouter } from '#imports'

interface TestResponse { message: string }

describe('API routes', () => {
  it('generates types for routes', () => {
    expectTypeOf($fetch('/api/hello')).toEqualTypeOf<Promise<string>>()
    expectTypeOf($fetch('/api/hey')).toEqualTypeOf<Promise<{ foo: string, baz: string }>>()
    expectTypeOf($fetch('/api/union')).toEqualTypeOf<Promise<{ type: 'a', foo: string } | { type: 'b', baz: string }>>()
    expectTypeOf($fetch('/api/other')).toEqualTypeOf<Promise<unknown>>()
    expectTypeOf($fetch<TestResponse>('/test')).toEqualTypeOf<Promise<TestResponse>>()
  })

  it('works with useAsyncData', () => {
    expectTypeOf(useAsyncData('api-hello', () => $fetch('/api/hello')).data).toEqualTypeOf<Ref<string | null>>()
    expectTypeOf(useAsyncData('api-hey', () => $fetch('/api/hey')).data).toEqualTypeOf<Ref<{ foo: string, baz: string } | null>>()
    expectTypeOf(useAsyncData('api-hey-with-pick', () => $fetch('/api/hey'), { pick: ['baz'] }).data).toEqualTypeOf<Ref<{ baz: string } | null>>()
    expectTypeOf(useAsyncData('api-union', () => $fetch('/api/union')).data).toEqualTypeOf<Ref<{ type: 'a', foo: string } | { type: 'b', baz: string } | null>>()
    expectTypeOf(useAsyncData('api-union-with-pick', () => $fetch('/api/union'), { pick: ['type'] }).data).toEqualTypeOf<Ref<{ type: 'a' } | { type: 'b' } | null>>()
    expectTypeOf(useAsyncData('api-other', () => $fetch('/api/other')).data).toEqualTypeOf<Ref<unknown>>()
    expectTypeOf(useAsyncData<TestResponse>('api-generics', () => $fetch('/test')).data).toEqualTypeOf<Ref<TestResponse | null>>()

    expectTypeOf(useAsyncData('api-error-generics', () => $fetch('/error')).error).toEqualTypeOf<Ref<Error | null>>()
    expectTypeOf(useAsyncData<any, string>('api-error-generics', () => $fetch('/error')).error).toEqualTypeOf<Ref<string | null>>()

    expectTypeOf(useLazyAsyncData('lazy-api-hello', () => $fetch('/api/hello')).data).toEqualTypeOf<Ref<string | null>>()
    expectTypeOf(useLazyAsyncData('lazy-api-hey', () => $fetch('/api/hey')).data).toEqualTypeOf<Ref<{ foo: string, baz: string } | null>>()
    expectTypeOf(useLazyAsyncData('lazy-api-hey-with-pick', () => $fetch('/api/hey'), { pick: ['baz'] }).data).toEqualTypeOf<Ref<{ baz: string } | null>>()
    expectTypeOf(useLazyAsyncData('lazy-api-union', () => $fetch('/api/union')).data).toEqualTypeOf<Ref<{ type: 'a', foo: string } | { type: 'b', baz: string } | null>>()
    expectTypeOf(useLazyAsyncData('lazy-api-union-with-pick', () => $fetch('/api/union'), { pick: ['type'] }).data).toEqualTypeOf<Ref<{ type: 'a' } | { type: 'b' } | null>>()
    expectTypeOf(useLazyAsyncData('lazy-api-other', () => $fetch('/api/other')).data).toEqualTypeOf<Ref<unknown>>()
    expectTypeOf(useLazyAsyncData<TestResponse>('lazy-api-generics', () => $fetch('/test')).data).toEqualTypeOf<Ref<TestResponse | null>>()

    expectTypeOf(useLazyAsyncData('lazy-error-generics', () => $fetch('/error')).error).toEqualTypeOf<Ref<Error | null>>()
    expectTypeOf(useLazyAsyncData<any, string>('lazy-error-generics', () => $fetch('/error')).error).toEqualTypeOf<Ref<string | null>>()
  })

  it('works with useFetch', () => {
    expectTypeOf(useFetch('/api/hello').data).toEqualTypeOf<Ref<string | null>>()
    expectTypeOf(useFetch('/api/hey').data).toEqualTypeOf<Ref<{ foo: string, baz: string } | null>>()
    expectTypeOf(useFetch('/api/hey', { pick: ['baz'] }).data).toEqualTypeOf<Ref<{ baz: string } | null>>()
    expectTypeOf(useFetch('/api/union').data).toEqualTypeOf<Ref<{ type: 'a', foo: string } | { type: 'b', baz: string } | null>>()
    expectTypeOf(useFetch('/api/union', { pick: ['type'] }).data).toEqualTypeOf<Ref<{ type: 'a' } | { type: 'b' } | null>>()
    expectTypeOf(useFetch('/api/other').data).toEqualTypeOf<Ref<unknown>>()
    expectTypeOf(useFetch<TestResponse>('/test').data).toEqualTypeOf<Ref<TestResponse | null>>()

    expectTypeOf(useFetch('/error').error).toEqualTypeOf<Ref<FetchError | null>>()
    expectTypeOf(useFetch<any, string>('/error').error).toEqualTypeOf<Ref<string | null>>()

    expectTypeOf(useLazyFetch('/api/hello').data).toEqualTypeOf<Ref<string | null>>()
    expectTypeOf(useLazyFetch('/api/hey').data).toEqualTypeOf<Ref<{ foo: string, baz: string } | null>>()
    expectTypeOf(useLazyFetch('/api/hey', { pick: ['baz'] }).data).toEqualTypeOf<Ref<{ baz: string } | null>>()
    expectTypeOf(useLazyFetch('/api/union').data).toEqualTypeOf<Ref<{ type: 'a', foo: string } | { type: 'b', baz: string } | null>>()
    expectTypeOf(useLazyFetch('/api/union', { pick: ['type'] }).data).toEqualTypeOf<Ref<{ type: 'a' } | { type: 'b' } | null>>()
    expectTypeOf(useLazyFetch('/api/other').data).toEqualTypeOf<Ref<unknown>>()
    expectTypeOf(useLazyFetch<TestResponse>('/test').data).toEqualTypeOf<Ref<TestResponse | null>>()

    expectTypeOf(useLazyFetch('/error').error).toEqualTypeOf<Ref<FetchError | null>>()
    expectTypeOf(useLazyFetch<any, string>('/error').error).toEqualTypeOf<Ref<string | null>>()
  })
})

describe('aliases', () => {
  it('allows importing from path aliases', () => {
    expectTypeOf(useRouter).toEqualTypeOf<typeof vueUseRouter>()
    expectTypeOf(isVue3).toEqualTypeOf<boolean>()
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
      expectTypeOf(to).toEqualTypeOf<RouteLocationNormalizedLoaded>()
      expectTypeOf(from).toEqualTypeOf<RouteLocationNormalizedLoaded>()
      expectTypeOf(navigateTo).toEqualTypeOf<(to: RouteLocationRaw | null | undefined, options?: NavigateToOptions) => RouteLocationRaw | Promise<void | NavigationFailure>>()
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
    // @ts-expect-error
    defineNuxtConfig({ undeclaredKey: { other: false } })
  })
})

describe('runtimeConfig', () => {
  it('generated runtimeConfig types', () => {
    const runtimeConfig = useRuntimeConfig()
    expectTypeOf(runtimeConfig.public.testConfig).toEqualTypeOf<number>()
    expectTypeOf(runtimeConfig.privateConfig).toEqualTypeOf<string>()
    expectTypeOf(runtimeConfig.unknown).toEqualTypeOf<any>()
  })
})

describe('head', () => {
  it('correctly types nuxt.config options', () => {
    defineNuxtConfig({ app: { head: { titleTemplate: () => 'test' } } })
    defineNuxtConfig({
      app: {
        head: {
          meta: [{ key: 'key', name: 'description', content: 'some description ' }],
          titleTemplate: 'test %s'
        }
      }
    })
  })
  it('types useHead', () => {
    useHead({
      base: { href: '/base' },
      link: computed(() => []),
      meta: [
        { key: 'key', name: 'description', content: 'some description ' },
        () => ({ key: 'key', name: 'description', content: 'some description ' })
      ],
      titleTemplate: (titleChunk) => {
        return titleChunk ? `${titleChunk} - Site Title` : 'Site Title'
      }
    })
  })
})

describe('composables', () => {
  it('allows providing default refs', () => {
    expectTypeOf(useState('test', () => ref('hello'))).toEqualTypeOf<Ref<string>>()
    expectTypeOf(useState('test', () => 'hello')).toEqualTypeOf<Ref<string>>()

    expectTypeOf(useCookie('test', { default: () => ref(500) })).toEqualTypeOf<Ref<number>>()
    expectTypeOf(useCookie('test', { default: () => 500 })).toEqualTypeOf<Ref<number>>()
    useCookie<number | null>('test').value = null

    expectTypeOf(useAsyncData('test', () => Promise.resolve(500), { default: () => ref(500) }).data).toEqualTypeOf<Ref<number | null>>()
    expectTypeOf(useAsyncData('test', () => Promise.resolve(500), { default: () => 500 }).data).toEqualTypeOf<Ref<number | null>>()
    // @ts-expect-error
    expectTypeOf(useAsyncData('test', () => Promise.resolve('500'), { default: () => ref(500) }).data).toEqualTypeOf<Ref<number | null>>()
    // @ts-expect-error
    expectTypeOf(useAsyncData('test', () => Promise.resolve('500'), { default: () => 500 }).data).toEqualTypeOf<Ref<number | null>>()

    expectTypeOf(useFetch('/test', { default: () => ref(500) }).data).toEqualTypeOf<Ref<number | null>>()
    expectTypeOf(useFetch('/test', { default: () => 500 }).data).toEqualTypeOf<Ref<number | null>>()
  })

  it('infer request url string literal from server/api routes', () => {
    // request can accept dynamic string type
    const dynamicStringUrl: string = 'https://example.com/api'
    expectTypeOf(useFetch(dynamicStringUrl).data).toEqualTypeOf<Ref<unknown>>()

    // request param should infer string literal type / show auto-complete hint base on server routes, ex: '/api/hello'
    expectTypeOf(useFetch('/api/hello').data).toEqualTypeOf<Ref<string | null>>()
    expectTypeOf(useLazyFetch('/api/hello').data).toEqualTypeOf<Ref<string | null>>()

    // request can accept string literal and Request object type
    expectTypeOf(useFetch('https://example.com/api').data).toEqualTypeOf<Ref<unknown>>()
    expectTypeOf(useFetch(new Request('test')).data).toEqualTypeOf<Ref<unknown>>()
  })

  it('provides proper type support when using overloads', () => {
    expectTypeOf(useState('test')).toEqualTypeOf(useState())
    expectTypeOf(useState('test', () => ({ foo: Math.random() }))).toEqualTypeOf(useState(() => ({ foo: Math.random() })))

    expectTypeOf(useAsyncData('test', () => Promise.resolve({ foo: Math.random() })))
      .toEqualTypeOf(useAsyncData(() => Promise.resolve({ foo: Math.random() })))
    expectTypeOf(useAsyncData('test', () => Promise.resolve({ foo: Math.random() }), { transform: data => data.foo }))
      .toEqualTypeOf(useAsyncData(() => Promise.resolve({ foo: Math.random() }), { transform: data => data.foo }))

    expectTypeOf(useLazyAsyncData('test', () => Promise.resolve({ foo: Math.random() })))
      .toEqualTypeOf(useLazyAsyncData(() => Promise.resolve({ foo: Math.random() })))
    expectTypeOf(useLazyAsyncData('test', () => Promise.resolve({ foo: Math.random() }), { transform: data => data.foo }))
      .toEqualTypeOf(useLazyAsyncData(() => Promise.resolve({ foo: Math.random() }), { transform: data => data.foo }))
  })
})

describe('app config', () => {
  it('merges app config as expected', () => {
    interface ExpectedMergedAppConfig {
      fromLayer: boolean,
      fromNuxtConfig: boolean,
      nested: {
        val: number
      },
      userConfig: number
    }
    expectTypeOf<AppConfig>().toMatchTypeOf<ExpectedMergedAppConfig>()
  })
})

describe('extends type declarations', () => {
  it('correctly adds references to tsconfig', () => {
    expectTypeOf<import('bing').BingInterface>().toEqualTypeOf<{ foo: 'bar' }>()
  })
})
