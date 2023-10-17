import { describe, expectTypeOf, it } from 'vitest'
import type { Ref } from 'vue'
import type { FetchError } from 'ofetch'
import type { NavigationFailure, RouteLocationNormalized, RouteLocationRaw, Router, useRouter as vueUseRouter } from '#vue-router'

import type { AppConfig, RuntimeValue } from 'nuxt/schema'
import { defineNuxtConfig } from 'nuxt/config'
import { callWithNuxt, isVue3 } from '#app'
import type { NavigateToOptions } from '#app/composables/router'
import { NuxtLayout, NuxtLink, NuxtPage, WithTypes } from '#components'
import { useRouter } from '#imports'

interface TestResponse { message: string }

describe('API routes', () => {
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
    expectTypeOf($fetch('/api/hey', { method: 'patch ' })).toEqualTypeOf<Promise<{ foo: string, baz: string }>>()
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
    expectTypeOf(useFetch('/api/hey', { method: 'GET' }).data).toEqualTypeOf<Ref<{ foo: string, baz: string } | null>>()
    expectTypeOf(useFetch('/api/hey', { method: 'get' }).data).toEqualTypeOf<Ref<{ foo: string, baz: string } | null>>()
    expectTypeOf(useFetch('/api/hey', { method: 'POST' }).data).toEqualTypeOf<Ref<{ method: 'post' } | null>>()
    expectTypeOf(useFetch('/api/hey', { method: 'post' }).data).toEqualTypeOf<Ref<{ method: 'post' } | null>>()
    // @ts-expect-error not a valid method
    useFetch('/api/hey', { method: 'PATCH' })
    expectTypeOf(useFetch('/api/hey', { pick: ['baz'] }).data).toEqualTypeOf<Ref<{ baz: string } | null>>()
    expectTypeOf(useFetch('/api/union').data).toEqualTypeOf<Ref<{ type: 'a', foo: string } | { type: 'b', baz: string } | null>>()
    expectTypeOf(useFetch('/api/union', { pick: ['type'] }).data).toEqualTypeOf<Ref<{ type: 'a' } | { type: 'b' } | null>>()
    expectTypeOf(useFetch('/api/other').data).toEqualTypeOf<Ref<unknown>>()
    expectTypeOf(useFetch<TestResponse>('/test').data).toEqualTypeOf<Ref<TestResponse | null>>()
    expectTypeOf(useFetch<TestResponse>('/test', { method: 'POST' }).data).toEqualTypeOf<Ref<TestResponse | null>>()

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
    definePageMeta({ middleware: 'named' })
    // provided by layer
    definePageMeta({ middleware: 'override' })
    definePageMeta({ middleware: 'foo' })
    // @ts-expect-error ignore global middleware
    definePageMeta({ middleware: 'global' })
    // @ts-expect-error Invalid middleware
    definePageMeta({ middleware: 'nonexistent' })
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
        // eslint-disable-next-line
        if (0) {
          return createError({
            statusCode: 404,
            statusMessage: 'resource-type-not-found'
          })
        }
        return true
      }
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
  })

  it('correctly reads custom names typed in `definePageMeta`', () => {
    const router = useRouter()
    router.push({ name: 'some-custom-name' })
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
    // this one does
    h(NuxtLink, { to: { name: 'page' } })
    // @ts-expect-error this is an invalid param
    h(NuxtLink, { to: { name: 'param-id', params: { bob: 23 } } })
    h(NuxtLink, { to: { name: 'param-id', params: { id: 4 } } })
  })
})

describe('layouts', () => {
  it('recognizes named layouts', () => {
    definePageMeta({ layout: 'custom' })
    definePageMeta({ layout: 'pascal-case' })
    definePageMeta({ layout: 'override' })
    // @ts-expect-error Invalid layout
    definePageMeta({ layout: 'invalid-layout' })
  })

  it('allows typing layouts', () => {
    h(NuxtLayout, { name: 'custom' })

    // @ts-expect-error Invalid layout
    h(NuxtLayout, { name: 'invalid-layout' })
  })
})

describe('modules', () => {
  it('augments schema automatically', () => {
    defineNuxtConfig({ sampleModule: { enabled: false } })
    // @ts-expect-error we want to ensure we throw type error on invalid option
    defineNuxtConfig({ sampleModule: { other: false } })
    // @ts-expect-error we want to ensure we throw type error on invalid key
    defineNuxtConfig({ undeclaredKey: { other: false } })
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

describe('runtimeConfig', () => {
  it('generated runtimeConfig types', () => {
    const runtimeConfig = useRuntimeConfig()
    expectTypeOf(runtimeConfig.public.testConfig).toEqualTypeOf<number>()
    expectTypeOf(runtimeConfig.public.needsFallback).toEqualTypeOf<string>()
    expectTypeOf(runtimeConfig.privateConfig).toEqualTypeOf<string>()
    expectTypeOf(runtimeConfig.public.ids).toEqualTypeOf<number[]>()
    expectTypeOf(runtimeConfig.unknown).toEqualTypeOf<unknown>()

    const injectedConfig = useNuxtApp().$config
    expectTypeOf(injectedConfig.public.testConfig).toEqualTypeOf<number>()
    expectTypeOf(injectedConfig.public.needsFallback).toEqualTypeOf<string>()
    expectTypeOf(injectedConfig.privateConfig).toEqualTypeOf<string>()
    expectTypeOf(injectedConfig.public.ids).toEqualTypeOf<number[]>()
    expectTypeOf(injectedConfig.unknown).toEqualTypeOf<unknown>()
  })
  it('provides hints on overriding these values', () => {
    const val = defineNuxtConfig({
      runtimeConfig: {
        public: {
          // @ts-expect-error this should be a number
          testConfig: 'test',
          ids: [1, 2]
        }
      }
    })
    expectTypeOf(val.runtimeConfig!.public!.testConfig).toEqualTypeOf<undefined | RuntimeValue<number, 'You can override this value at runtime with NUXT_PUBLIC_TEST_CONFIG'>>()
    expectTypeOf(val.runtimeConfig!.privateConfig).toEqualTypeOf<undefined | RuntimeValue<string, 'You can override this value at runtime with NUXT_PRIVATE_CONFIG'>>()
    expectTypeOf(val.runtimeConfig!.baseURL).toEqualTypeOf<undefined | RuntimeValue<string, 'You can override this value at runtime with NUXT_BASE_URL'>>()
    expectTypeOf(val.runtimeConfig!.baseAPIToken).toEqualTypeOf<undefined | RuntimeValue<string, 'You can override this value at runtime with NUXT_BASE_API_TOKEN'>>()
    expectTypeOf(val.runtimeConfig!.public!.ids).toEqualTypeOf<undefined | RuntimeValue<Array<number>, 'You can override this value at runtime with NUXT_PUBLIC_IDS'>>()
    expectTypeOf(val.runtimeConfig!.unknown).toEqualTypeOf<unknown>()
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

    expectTypeOf(useFetch('/test', { default: () => ref(500) }).data).toEqualTypeOf<Ref<unknown>>()
    expectTypeOf(useFetch('/test', { default: () => 500 }).data).toEqualTypeOf<Ref<unknown>>()
  })

  it('correct types when using ResT type-assertion with default function', () => {
    // @ts-expect-error default type should match generic type
    useFetch<string>('/test', { default: () => 0 })
    // @ts-expect-error default type should match generic type
    useLazyFetch<string>('/test', { default: () => 0 })
    // @ts-expect-error default type should match generic type
    useAsyncData<string>(() => $fetch('/test'), { default: () => 0 })
    // @ts-expect-error default type should match generic type
    useLazyAsyncData<string>(() => $fetch('/test'), { default: () => 0 })

    expectTypeOf(useFetch<string>('/test', { default: () => 'test' }).data).toEqualTypeOf<Ref<string>>()
    expectTypeOf(useLazyFetch<string>('/test', { default: () => 'test' }).data).toEqualTypeOf<Ref<string>>()
    expectTypeOf(useAsyncData<string>(() => $fetch('/test'), { default: () => 'test' }).data).toEqualTypeOf<Ref<string>>()
    expectTypeOf(useLazyAsyncData<string>(() => $fetch('/test'), { default: () => 'test' }).data).toEqualTypeOf<Ref<string>>()

    // transform must match the explicit generic because of typescript limiations microsoft/TypeScript#14400
    expectTypeOf(useFetch<string>('/test', { transform: () => 'transformed' }).data).toEqualTypeOf<Ref<string | null>>()
    expectTypeOf(useLazyFetch<string>('/test', { transform: () => 'transformed' }).data).toEqualTypeOf<Ref<string | null>>()
    expectTypeOf(useAsyncData<string>(() => $fetch('/test'), { transform: () => 'transformed' }).data).toEqualTypeOf<Ref<string | null>>()
    expectTypeOf(useLazyAsyncData<string>(() => $fetch('/test'), { transform: () => 'transformed' }).data).toEqualTypeOf<Ref<string | null>>()

    expectTypeOf(useFetch<string>('/test', { default: () => 'test', transform: () => 'transformed' }).data).toEqualTypeOf<Ref<string>>()
    expectTypeOf(useLazyFetch<string>('/test', { default: () => 'test', transform: () => 'transformed' }).data).toEqualTypeOf<Ref<string>>()
    expectTypeOf(useAsyncData<string>(() => $fetch('/test'), { default: () => 'test', transform: () => 'transformed' }).data).toEqualTypeOf<Ref<string>>()
    expectTypeOf(useLazyAsyncData<string>(() => $fetch('/test'), { default: () => 'test', transform: () => 'transformed' }).data).toEqualTypeOf<Ref<string>>()
  })

  it('infer request url string literal from server/api routes', () => {
    // request can accept dynamic string type
    const dynamicStringUrl = 'https://example.com/api'
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

    // Default values: #14437
    // TODO: what?!
    expectTypeOf(useAsyncData('test', () => Promise.resolve({ foo: { bar: 500 } }), { default: () => ({ bar: 500 }), transform: v => v.foo }).data).toEqualTypeOf<Ref<{ bar: number } | { bar: number }>>()
    expectTypeOf(useLazyAsyncData('test', () => Promise.resolve({ foo: { bar: 500 } }), { default: () => ({ bar: 500 }), transform: v => v.foo }))
      .toEqualTypeOf(useLazyAsyncData(() => Promise.resolve({ foo: { bar: 500 } }), { default: () => ({ bar: 500 }), transform: v => v.foo }))
    expectTypeOf(useFetch('/api/hey', { default: () => 1, transform: v => v.foo }).data).toEqualTypeOf<Ref<string | number>>()
    expectTypeOf(useLazyFetch('/api/hey', { default: () => 'bar', transform: v => v.foo }).data).toEqualTypeOf<Ref<string>>()
  })

  it('uses types compatible between useRequestHeaders and useFetch', () => {
    useFetch('/api/hey', {
      headers: useRequestHeaders()
    })
    useFetch('/api/hey', {
      headers: useRequestHeaders(['test'])
    })
    const { test } = useRequestHeaders(['test'])
    expectTypeOf(test).toEqualTypeOf<string | undefined>()
  })

  it('allows passing reactive values in useFetch', () => {
    useFetch('/api/hey', {
      headers: {
        key: ref('test')
      },
      query: {
        param: computed(() => 'thing')
      }
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
})

describe('app config', () => {
  it('merges app config as expected', () => {
    interface ExpectedMergedAppConfig {
      nuxt: { buildId: string }
      fromLayer: boolean
      fromNuxtConfig: boolean
      nested: {
        val: number
      }
      userConfig: 123 | 456
      someThing?: {
        value?: string | false,
      }
      [key: string]: unknown
    }
    expectTypeOf<AppConfig>().toEqualTypeOf<ExpectedMergedAppConfig>()
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
    expectTypeOf<typeof bob>().toEqualTypeOf<boolean | Promise<boolean>>()
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
