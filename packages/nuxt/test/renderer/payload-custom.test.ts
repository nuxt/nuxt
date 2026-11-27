import { describe, expect, it, vi } from 'vitest'
import { isReactive, isShallow, reactive, shallowReactive, toRaw } from 'vue'
import { parse } from 'devalue'
import type { NuxtSSRContext } from 'nuxt/app'
import { decodePayload } from '../../src/app/internal/payload-codec.ts'
import type { RendererEvent } from '../../src/runtime/server/renderer/runtime.ts'

const OBFUSCATION_KEY = 'test-build-key-xyz'

vi.mock('nuxt/internal/renderer-config', async importOriginal => ({
  ...await importOriginal<typeof import('nuxt/internal/renderer-config')>(),
  NUXT_POWERED_BY: false,
  NUXT_PAYLOAD_OBFUSCATION_KEY: OBFUSCATION_KEY,
  NUXT_PAYLOAD_SCRIPT_TYPE: 'text/plain',
  appPayloadId: '_ctx_9a3f',
  appPayloadDataAttr: false,
  appSsrAttr: false,
  appGlobalName: false,
  appPayloadFileName: 'state.bin',
}))

const { renderPayloadJsonScript, renderPayloadResponse } = await import('../../src/runtime/server/renderer/payload.ts')

function createContext () {
  return {
    'url': '/',
    'payload': {
      data: shallowReactive({}),
      state: reactive({ '$scolor-mode': { preference: 'dark' } }),
      once: new Set<string>(),
      _errors: shallowReactive({}),
      pinia: reactive({ featureFlags: { isMockingAllowed: false } }),
    },
    'config': { public: { siteName: 'SecureApp' }, app: { baseURL: '/' } },
    'runtimeConfig': { app: { buildId: 'build-1' } },
    '~payloadReducers': {
      ShallowReactive: (data: unknown) => isReactive(data) && isShallow(data) && toRaw(data),
      Reactive: (data: unknown) => isReactive(data) && toRaw(data),
    },
  } as unknown as NuxtSSRContext
}

describe('custom stealth payload rendering', () => {
  it('omits nuxt identifiers, removes window.__NUXT__, and obfuscates pinia + state in script tag', () => {
    const ctx = createContext()
    const scripts = renderPayloadJsonScript({ ssrContext: ctx, data: ctx.payload })

    expect(scripts).toHaveLength(1)
    const script = scripts[0]!
    expect(script.id).toBe('_ctx_9a3f')
    expect(script.type).toBe('text/plain')
    expect(script['data-nuxt-data']).toBeUndefined()
    expect(script['data-ssr']).toBeUndefined()

    const body = String(script.innerHTML)
    expect(body).not.toContain('pinia')
    expect(body).not.toContain('featureFlags')
    expect(body).not.toContain('isMockingAllowed')
    expect(body).not.toContain('SecureApp')
    expect(body).not.toContain('ShallowReactive')

    const decoded = decodePayload(body, OBFUSCATION_KEY)
    const revived = parse(decoded, {
      ShallowReactive: (v: Record<string, unknown>) => v,
      Reactive: (v: Record<string, unknown>) => v,
    })
    expect(revived.serverRendered).toBe(true)
    expect(revived.config).toEqual({ public: { siteName: 'SecureApp' }, app: { baseURL: '/' } })
    expect(revived.pinia).toEqual({ featureFlags: { isMockingAllowed: false } })
    expect(revived.state['$scolor-mode']).toEqual({ preference: 'dark' })
  })

  it('omits x-powered-by and obfuscates external payload responses', () => {
    const ctx = createContext()
    const res = renderPayloadResponse(ctx, { res: {} } as RendererEvent)

    expect(res.headers['x-powered-by']).toBeUndefined()
    expect(res.headers['content-type']).toBe('text/plain;charset=utf-8')
    expect(String(res.body)).not.toContain('build-1')

    const decoded = decodePayload(String(res.body), OBFUSCATION_KEY)
    const revived = parse(decoded, {
      ShallowReactive: (v: Record<string, unknown>) => v,
    })
    expect(revived.buildId).toBe('build-1')
  })
})
