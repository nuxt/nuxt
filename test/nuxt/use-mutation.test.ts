/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { describe, expect, it } from 'vitest'
import { defineEventHandler, readBody } from 'h3'
import { registerEndpoint } from '@nuxt/test-utils/runtime'

import { computed } from 'vue'
import { createUseAsyncDataMutation, useAsyncDataMutation } from '#app/composables/asyncDataMutation'
import { createUseFetchMutation, useFetchMutation } from '#app/composables/fetchMutation'
import { defineUseAsyncDataMutationAddon, defineUseFetchMutationAddon } from '#app/composables/addons'
import type { UseAsyncDataMutationAddonOptions } from '#app/composables/addons'

registerEndpoint('/api/mutation', defineEventHandler(async event => ({
  method: event.req.method,
  query: Object.fromEntries(new URL(event.req.url).searchParams),
  header: event.req.headers.get('x-test'),
  body: await readBody(event),
})))

describe('useAsyncDataMutation', () => {
  it('passes the input to the handler and stores the result', async () => {
    const { data, status, mutate } = useAsyncDataMutation((input: number) => Promise.resolve(input * 2), { transform: n => `${n}` })
    expect(status.value).toBe('idle')
    await mutate(21)
    expect(data.value).toBe('42')
    expect(status.value).toBe('success')
  })

  it('reports a failure without rejecting', async () => {
    const { data, error, status, mutate, clear } = useAsyncDataMutation(() => Promise.reject(new Error('nope')), { default: () => 'fallback' })
    await expect(mutate()).resolves.toBeUndefined()
    expect(error.value?.message).toBe('nope')
    expect(status.value).toBe('error')
    expect(data.value).toBe('fallback')
    clear()
    expect(error.value).toBeUndefined()
    expect(status.value).toBe('idle')
  })

  it('cancels a pending call by default and joins it with `dedupe: \'defer\'`', async () => {
    let calls = 0
    const { data, mutate } = useAsyncDataMutation((input: string) => {
      calls++
      return new Promise<string>(resolve => setTimeout(() => resolve(input), 10))
    })
    await Promise.all([mutate('first'), mutate('second')])
    expect(data.value).toBe('second')

    await Promise.all([mutate('third'), mutate('fourth', { dedupe: 'defer' })])
    expect(data.value).toBe('third')
    expect(calls).toBe(3)
  })

  it('discards a result whose transform settles after `clear`', async () => {
    let onTransform!: () => void
    const transforming = new Promise<void>((resolve) => { onTransform = resolve })
    const { data, status, mutate, clear } = useAsyncDataMutation((input: string) => Promise.resolve(input), {
      transform: (input) => {
        onTransform()
        return new Promise<string>(resolve => setTimeout(() => resolve(input), 10))
      },
    })
    const promise = mutate('stale')
    await transforming
    clear()
    await promise
    expect(data.value).toBeUndefined()
    expect(status.value).toBe('idle')
  })
})

describe('useFetchMutation', () => {
  it('sends the payload passed to each call, merged over the options', async () => {
    const { data, mutate } = useFetchMutation('/api/mutation', { method: 'post', query: { a: '1' }, headers: { 'x-test': 'static' } })
    await mutate({ body: { id: 1 }, query: { b: '2' } })
    expect(data.value).toEqual({ method: 'POST', query: { a: '1', b: '2' }, header: 'static', body: { id: 1 } })

    await mutate({ body: { id: 2 }, headers: { 'x-test': 'call' } })
    expect(data.value).toMatchObject({ header: 'call', body: { id: 2 } })
  })

  it('rejects a protocol-relative URL', async () => {
    const { error, mutate } = useFetchMutation('//example.com/api', { method: 'post' })
    await mutate()
    expect(error.value?.cause).toMatchObject({ code: 'NUXT_E3001' })
  })

  it('drops `params` rather than sending it as `query`', async () => {
    // @ts-expect-error `params` is not an option
    const { data, mutate } = useFetchMutation('/api/mutation', { method: 'post', params: { a: '1' } })
    await mutate()
    expect(data.value?.query).toStrictEqual({})
  })

  it('sends only `body`, `query` and `headers` from the payload', async () => {
    const { data, mutate } = useFetchMutation('/api/mutation', { method: 'post' })
    // @ts-expect-error neither `params` nor `method` is part of the payload
    await mutate({ body: { id: 1 }, params: { a: '1' }, method: 'put' })
    expect(data.value).toMatchObject({ method: 'POST', body: { id: 1 } })
    expect(data.value?.query).toStrictEqual({})
  })
})

describe('mutation factories', () => {
  it('applies factory options as defaults, or as overrides when given a function', () => {
    const withDefaults = createUseAsyncDataMutation({ default: () => 'factory' })
    expect(withDefaults(() => Promise.resolve('x')).data.value).toBe('factory')
    expect(withDefaults(() => Promise.resolve('x'), { default: () => 'caller' }).data.value).toBe('caller')

    const withOverrides = createUseAsyncDataMutation(() => ({ default: () => 'factory' }))
    expect(withOverrides(() => Promise.resolve('x'), { default: () => 'caller' }).data.value).toBe('factory')
  })

  it('runs addon middleware with custom options and merges extensions', async () => {
    const suffix = defineUseAsyncDataMutationAddon({
      setup: (options: UseAsyncDataMutationAddonOptions<{ suffix?: string }>) => {
        options.suffix ??= '!'
        options.middleware.push(async next => `${await next()}${options.suffix}`)
        return mutation => ({ isDone: computed(() => mutation.status.value === 'success') })
      },
    })
    const useSuffixedMutation = createUseAsyncDataMutation({ addons: [suffix] })
    const { data, isDone, mutate } = useSuffixedMutation((input: string) => Promise.resolve(input), { suffix: '?' })
    await mutate('hi')
    expect(data.value).toBe('hi?')
    expect(isDone.value).toBe(true)
  })

  it('does not let an addon extension make a mutation awaitable', () => {
    const thenable = defineUseAsyncDataMutationAddon({
      setup: () => () => ({ then: () => Promise.resolve() }),
    })
    const mutation = createUseAsyncDataMutation({ addons: [thenable] })(() => Promise.resolve(true))
    expect('then' in mutation).toBe(false)
  })

  it('applies factory fetch options and addon fetch hooks', async () => {
    const header = defineUseFetchMutationAddon({
      setup: (options) => {
        options.onRequest.push(({ options }) => { options.headers.set('x-test', 'addon') })
      },
    })
    const useApiMutation = createUseFetchMutation({ baseURL: '/api', method: 'post', addons: [header] })
    const { data, mutate } = useApiMutation('/mutation')
    await mutate({ body: { id: 1 } })
    expect(data.value).toMatchObject({ method: 'POST', header: 'addon', body: { id: 1 } })
  })
})
