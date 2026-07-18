import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import { navigateTo } from '#app/composables/router'
import { useAsyncData } from '#app/composables/asyncData'
import { defineKeyedFunctionFactory } from '../../../packages/nuxt/src/compiler/runtime'

describe('navigation diagnostics (dev)', () => {
  it('reports a full message when navigating to an external URL by default', () => {
    expect(() => navigateTo('https://test.com')).toThrowErrorMatchingInlineSnapshot('[NUXT_E2001: Navigating to external URL `https://test.com` is not allowed by default.]')
  })

  it('reports a full message when navigating to script/data URLs', () => {
    for (const url of ['data:alert("hi")', '\0data:alert("hi")']) {
      expect(() => navigateTo(url, { external: true })).toThrow('with `data:` protocol.')
    }
  })
})

describe('useAsyncData diagnostics (dev)', () => {
  let uniqueKey: string
  let counter = 0

  beforeEach(() => {
    uniqueKey = `key-${++counter}`
  })

  async function mountWithAsyncData (...args: any[]) {
    let res!: ReturnType<typeof useAsyncData>
    const component = defineComponent({
      setup () {
        res = useAsyncData(...args as [any])
        return () => h('div', [res.data.value as any])
      },
    })

    const c = await mountSuspended(component)
    const { then: _then, catch: _catch, finally: _finally, ...asyncData } = res
    return Object.assign(c, asyncData)
  }

  it('reports a full message when the key is empty', () => {
    expect(() => useAsyncData('', () => Promise.resolve('test'))).toThrowErrorMatchingInlineSnapshot('[NUXT_E3008: `useAsyncData` key must be a non-empty string.]')
  })

  it('warns when incompatible options are detected for the same key', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await mountWithAsyncData('dedupedKey3', () => Promise.resolve('test'), { deep: false })
    expect(warn).not.toHaveBeenCalled()
    await mountWithAsyncData('dedupedKey3', () => Promise.resolve('test'), { deep: true })
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(
      /\[NUXT_E3004\] Incompatible options detected for "dedupedKey3":\n- mismatching `deep` option\n├▶ fix: You can use a different key or move the call to a composable to ensure the options are shared across calls.\n╰▶ sources: .*:\d+:\d+/,
    ))

    let count = 0
    for (const opt of ['transform', 'pick', 'getCachedData'] as const) {
      warn.mockClear()
      count++

      await mountWithAsyncData(`${uniqueKey}-${count}`, () => Promise.resolve('test'), { [opt]: () => ({}) })
      await mountWithAsyncData(`${uniqueKey}-${count}`, () => Promise.resolve('test'), { [opt]: () => ({}) })
      expect(warn).not.toHaveBeenCalled()
      await mountWithAsyncData(`${uniqueKey}-${count}`, () => Promise.resolve('test'))
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(`\\[NUXT_E3004\\] Incompatible options detected for "${uniqueKey}-${count}":\n- different \`${opt}\` option\n├▶ fix: You can use a different key or move the call to a composable to ensure the options are shared across calls.\n╰▶ sources: .*:\\d+:\\d+`),
        ))
    }

    warn.mockClear()
    count++

    await mountWithAsyncData(`${uniqueKey}-${count}`, () => Promise.resolve('test'))
    expect(warn).not.toHaveBeenCalled()
    await mountWithAsyncData(`${uniqueKey}-${count}`, () => Promise.resolve('bob'))
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(
      new RegExp(`\\[NUXT_E3004\\] Incompatible options detected for "${uniqueKey}-${count}":\n- different handler\n├▶ fix: You can use a different key or move the call to a composable to ensure the options are shared across calls.\n╰▶ sources: .*:\\d+:\\d+`),
    ))

    warn.mockReset()
  })
})

describe('compiler macro diagnostics (dev)', () => {
  it('reports a full message when a keyed function factory is called at runtime', () => {
    const factory = defineKeyedFunctionFactory({
      name: 'createUseFetch',
      factory: (a: string, b: number): string => `${a}-${b}`,
    })

    expect(() => factory('a', 1)).toThrowErrorMatchingInlineSnapshot(`[NUXT_E1007: \`createUseFetch\` is a compiler macro or compiler-hint helper and cannot be called at runtime. Its arguments are meant to be compiled away.]`)
  })
})
