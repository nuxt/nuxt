import { expectTypeOf } from 'expect-type'
import { describe, it } from 'vitest'
import type { Ref } from 'vue'

import { NavigationFailure, RouteLocationNormalizedLoaded, RouteLocationRaw, useRouter as vueUseRouter } from 'vue-router'
import { defineNuxtConfig } from '~~/../../../packages/nuxt3/src'
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

  it('works with useFetch', () => {
    expectTypeOf(useFetch('/api/hello').data).toMatchTypeOf<Ref<string>>()
    expectTypeOf(useFetch('/api/hey').data).toMatchTypeOf<Ref<{ foo:string, baz: string }>>()
    expectTypeOf(useFetch('/api/hey', { pick: ['baz'] }).data).toMatchTypeOf<Ref<{ baz: string }>>()
    expectTypeOf(useFetch('/api/other').data).toMatchTypeOf<Ref<unknown>>()
    expectTypeOf(useFetch<TestResponse>('/test').data).toMatchTypeOf<Ref<TestResponse>>()
    expectTypeOf(useLazyFetch('/api/hello').data).toMatchTypeOf<Ref<string>>()
    expectTypeOf(useLazyFetch('/api/hey').data).toMatchTypeOf<Ref<{ foo:string, baz: string }>>()
    expectTypeOf(useLazyFetch('/api/hey', { pick: ['baz'] }).data).toMatchTypeOf<Ref<{ baz: string }>>()
    expectTypeOf(useLazyFetch('/api/other').data).toMatchTypeOf<Ref<unknown>>()
    expectTypeOf(useLazyFetch('/api/other').data).toMatchTypeOf<Ref<unknown>>()
    expectTypeOf(useLazyFetch<TestResponse>('/test').data).toMatchTypeOf<Ref<TestResponse>>()
  })
})

describe('aliases', () => {
  it('allows importing from path aliases', () => {
    expectTypeOf(useRouter).toMatchTypeOf<typeof vueUseRouter>()
    expectTypeOf(isVue3).toMatchTypeOf<boolean>()
  })
})

describe('middleware', () => {
  it('recognises named middleware', () => {
    definePageMeta({ middleware: 'test-middleware' })
    definePageMeta({ middleware: 'pascal-case' })
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
  it('recognises named layouts', () => {
    definePageMeta({ layout: 'test-layout' })
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
