/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { getRouteRules } from '#app/composables/manifest'
import { useLayout } from '#app/composables/layout'

const { matcher } = vi.hoisted(() => ({ matcher: vi.fn((_path: string): Record<string, unknown> => ({})) }))
vi.mock('#build/route-rules.mjs', () => ({ default: matcher }))

describe('a throwing route rules matcher', () => {
  let consoleError: MockInstance<typeof console.error>

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    matcher.mockImplementation(() => { throw new Error('invalid route rules') })
  })

  afterEach(async () => {
    matcher.mockReset()
    matcher.mockImplementation(() => ({}))
    await navigateTo('/')
    consoleError.mockRestore()
  })

  it('resolves no route rules and reports `NUXT_E5003`', () => {
    expect(getRouteRules({ path: '/throwing' })).toEqual({})
    expect(matcher).toHaveBeenCalledWith('/throwing')
    expect(consoleError).toHaveBeenCalledWith('[NUXT_E5003]')
  })

  it('resolves the default layout', async () => {
    const wrapper = await mountSuspended(defineComponent({
      setup: () => () => h('div', useLayout().value as string),
    }))
    expect(wrapper.text()).toBe('default')
    expect(consoleError).toHaveBeenCalledWith('[NUXT_E5003]')
  })

  it('does not block navigation', async () => {
    await navigateTo('/throwing')
    expect(useRoute().path).toBe('/throwing')
    expect(useError().value).toBeUndefined()
    expect(matcher).toHaveBeenCalledWith('/throwing')
    expect(consoleError).toHaveBeenCalledWith('[NUXT_E5003]')
  })
})
