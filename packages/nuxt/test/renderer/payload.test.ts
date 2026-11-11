import { afterEach, describe, expect, it, vi } from 'vitest'
import { isReactive, isShallow, reactive, shallowReactive, toRaw } from 'vue'
import type { NuxtSSRContext } from 'nuxt/app'

import { getPayloadKeySizes, renderPayloadJsonScript, renderPayloadResponse } from '../../src/runtime/server/renderer/payload.ts'
import type { RendererEvent } from '../../src/runtime/server/renderer/runtime.ts'

function ssrContext (url = '/', payload?: Record<string, unknown>) {
  return {
    url,
    payload,
    'config': {},
    'runtimeConfig': { app: { buildId: 'test' } },
    '~payloadReducers': {
      ShallowReactive: (data: unknown) => isReactive(data) && isShallow(data) && toRaw(data),
      Reactive: (data: unknown) => isReactive(data) && toRaw(data),
    },
  } as unknown as NuxtSSRContext
}

function createPayload (keys: string[]) {
  const shared = { shared: true }
  const payload = {
    data: shallowReactive<Record<string, unknown>>({}),
    state: reactive<Record<string, unknown>>({}),
    once: new Set<string>(),
    _errors: shallowReactive<Record<string, unknown>>({}),
  }
  for (const key of keys) {
    payload.data[key] = { key, shared }
    payload.state[`$s${key}`] = key
    payload.once.add(key)
    payload._errors[key] = undefined
  }
  return payload
}

describe('payload serialisation', () => {
  it('does not depend on the order payload keys were added in', () => {
    const script = (keys: string[]) => renderPayloadJsonScript({ ssrContext: ssrContext(), data: createPayload(keys) })[0]!.innerHTML
    expect(script(['b', 'a', 'c'])).toBe(script(['a', 'b', 'c']))
    expect(script(['c', 'a', 'b'])).toMatchInlineSnapshot(`"[{"data":1,"state":11,"once":13,"_errors":14},["ShallowReactive",2],{"a":3,"b":7,"c":9},{"key":4,"shared":5},"a",{"shared":6},true,{"key":8,"shared":5},"b",{"key":10,"shared":5},"c",["Reactive",12],{"$sa":4,"$sb":8,"$sc":10},["Set",4,8,10],["ShallowReactive",15],{"a":-1,"b":-1,"c":-1}]"`)
  })

  it('does not depend on the order payload data was added in for `_payload.json`', () => {
    const event = { res: {} } as RendererEvent
    const response = (keys: string[]) => renderPayloadResponse(ssrContext('/', createPayload(keys)), event).body
    expect(response(['b', 'a', 'c'])).toBe(response(['a', 'b', 'c']))
  })
})

describe('getPayloadKeySizes', () => {
  it('returns keys sorted by serialized size', () => {
    const sizes = getPayloadKeySizes({
      small: 'a',
      large: 'x'.repeat(100),
      medium: 'y'.repeat(10),
    }, {})

    expect(sizes.map(([key]) => key)).toEqual(['large', 'medium', 'small'])
  })

  it('skips values that cannot be stringified', () => {
    const sizes = getPayloadKeySizes({
      fn: () => {},
      ok: 'value',
    }, {})

    expect(sizes.map(([key]) => key)).toEqual(['ok'])
  })
})

describe('renderPayloadJsonScript (dev)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('warns once about large payloads with the largest keys', () => {
    vi.stubGlobal('__TEST_DEV__', true)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const data = { data: { big: 'z'.repeat(200 * 1024), small: 'tiny' } }
    renderPayloadJsonScript({ ssrContext: ssrContext('/large'), data })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('NUXT_E8006'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`big`'))

    warn.mockClear()
    renderPayloadJsonScript({ ssrContext: ssrContext('/large'), data })
    expect(warn).not.toHaveBeenCalled()
  })

  it('does not warn for small payloads', () => {
    vi.stubGlobal('__TEST_DEV__', true)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    renderPayloadJsonScript({ ssrContext: ssrContext('/small'), data: { data: { key: 'value' } } })
    expect(warn).not.toHaveBeenCalled()
  })
})
