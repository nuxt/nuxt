import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/app/nuxt', () => ({
  useNuxtApp: () => ({
    _payloadRevivers: {}
  })
}))

vi.mock('../src/app/composables/payload', async (importOriginal) => {
  const original = await importOriginal() as any
  return {
    ...original,
    parsePayload: vi.fn(async (payload: string) => {
      try {
        return JSON.parse(payload)
      } catch {
        return {}
      }
    })
  }
})

// Mock global config values
Object.defineProperty(globalThis, 'appId', {
  value: 'default',
  writable: true
})

// Mock import.meta for client environment
Object.defineProperty(globalThis, 'import', {
  value: { meta: { server: false } }
})

// Setup DOM and window.__NUXT__ for single and multi app scenarios
function setupDom({ multiApp = false, appId = 'default', inlineData = '{}', externalData = null } = {}) {
  // Clean up
  document.body.innerHTML = ''
  // @ts-ignore
  delete window.__NUXT__

  const el = document.createElement('script')
  el.setAttribute('data-nuxt-data', appId)
  el.textContent = inlineData
  if (externalData) {
    el.dataset.src = externalData
  }
  document.body.appendChild(el)
  // @ts-ignore
  window.__NUXT__ = { [appId]: { extra: 'external' } }
}

describe('getNuxtClientPayload unified behavior', () => {
  beforeEach(() => {
    // Reset cache and DOM
    // @ts-ignore
    window.__NUXT__ = undefined
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it('should handle single app scenario using unified logic', async () => {
    setupDom({ multiApp: false, appId: 'default', inlineData: '{"foo":"bar"}' })
    
    const { getNuxtClientPayload } = await import('../src/app/composables/payload')
    const payload = await getNuxtClientPayload()
    
    // Should find element by ID and merge with window.__NUXT__[appId]
    expect(payload).toMatchObject({ foo: 'bar', extra: 'external' })
  })

  it('should handle multi app scenario', async () => {
    setupDom({ multiApp: true, appId: 'test', inlineData: '{"bar":123}' })
    // @ts-ignore
    globalThis.appId = 'test'
    
    const { getNuxtClientPayload } = await import('../src/app/composables/payload')
    const payload = await getNuxtClientPayload()
    
    // Should find element by data attribute and merge with window.__NUXT__[appId]
    expect(payload).toMatchObject({ bar: 123, extra: 'external' })
  })

  it('should fallback from multi-app selector to single app selector', async () => {
    // Setup single app element but use multi-app appId
    setupDom({ multiApp: false, appId: 'default', inlineData: '{"fallback":true}' })
    // @ts-ignore
    globalThis.appId = 'test' // Different appId to test fallback
    
    const { getNuxtClientPayload } = await import('../src/app/composables/payload')
    const payload = await getNuxtClientPayload()
    
    // Should fallback to #__NUXT_DATA__ element
    expect(payload).toMatchObject({ fallback: true, extra: 'external' })
  })

  it('should return empty object if no data element found', async () => {
    // @ts-ignore
    globalThis.appId = 'default'
    
    const { getNuxtClientPayload } = await import('../src/app/composables/payload')
    const payload = await getNuxtClientPayload()
    
    expect(payload).toEqual({})
  })
})
