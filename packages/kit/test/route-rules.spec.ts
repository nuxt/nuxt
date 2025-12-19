import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHooks } from 'hookable'

import {
  extendRouteRules,
  getRouteRules,
} from '../src/route-rules.ts'

const createMockNuxt = () => {
  const hooks = createHooks()
  return {
    options: {
      nitro: {
        routeRules: {} as Record<string, any>,
      },
      routeRules: {} as Record<string, any>,
    },
    hook: hooks.hook.bind(hooks),
    _nitro: null as any,
  }
}

let mockNuxt: ReturnType<typeof createMockNuxt>

vi.mock('../src/context', () => ({
  useNuxt: () => mockNuxt,
}))

vi.mock('../src/nitro', () => ({
  tryUseNitro: () => mockNuxt._nitro,
}))

beforeEach(() => {
  mockNuxt = createMockNuxt()
})

describe('getRouteRules', () => {
  it('returns merged rules for exact path', () => {
    mockNuxt.options.nitro.routeRules = {
      '/api/users': { cors: true, cache: { maxAge: 60 } },
    }
    expect(getRouteRules('/api/users')).toEqual({
      cors: true,
      cache: { maxAge: 60 },
    })
  })

  it('matches wildcard patterns', () => {
    mockNuxt.options.nitro.routeRules = {
      '/api/**': { cors: true },
    }
    expect(getRouteRules('/api/users/123')).toEqual({ cors: true })
  })

  it('merges multiple matching rules', () => {
    mockNuxt.options.nitro.routeRules = {
      '/api/**': { cors: true },
      '/api/users/**': { cache: { maxAge: 60 } },
    }
    expect(getRouteRules('/api/users/123')).toEqual({
      cors: true,
      cache: { maxAge: 60 },
    })
  })

  it('returns empty object for unmatched path', () => {
    mockNuxt.options.nitro.routeRules = {
      '/api/**': { cors: true },
    }
    expect(getRouteRules('/other')).toEqual({})
  })
})

describe('extendRouteRules', () => {
  describe('single route signature', () => {
    it('adds new route rule', async () => {
      await extendRouteRules('/api/**', { cors: true })

      expect(mockNuxt.options.routeRules).toEqual({ '/api/**': { cors: true } })
      expect(mockNuxt.options.nitro.routeRules).toEqual({ '/api/**': { cors: true } })
    })

    it('merges with existing rules (existing takes precedence)', async () => {
      mockNuxt.options.routeRules = { '/api/**': { cors: true, ssr: true } }
      mockNuxt.options.nitro.routeRules = { '/api/**': { cors: true, ssr: true } }

      await extendRouteRules('/api/**', { cors: false, prerender: true })

      // existing cors: true takes precedence over new cors: false
      expect(mockNuxt.options.routeRules).toEqual({
        '/api/**': { cors: true, ssr: true, prerender: true },
      })
      expect(mockNuxt.options.nitro.routeRules).toEqual({
        '/api/**': { cors: true, ssr: true, prerender: true },
      })
    })

    it('override is deprecated shorthand for order: 10', async () => {
      await extendRouteRules('/api/**', { cors: true }, { override: true })

      // override: true sets order to 10 in the stack
      const stack = (mockNuxt as any)[Symbol.for('nuxt-kit:routeRulesStack')]
      expect(stack[0].order).toBe(10)
    })
  })

  describe('record signature', () => {
    it('adds multiple route rules', async () => {
      await extendRouteRules({
        '/api/**': { cors: true },
        '/static/**': { prerender: true },
      })

      expect(mockNuxt.options.routeRules).toEqual({
        '/api/**': { cors: true },
        '/static/**': { prerender: true },
      })
    })

    it('merges with existing rules', async () => {
      mockNuxt.options.routeRules = { '/api/**': { cors: true } }
      mockNuxt.options.nitro.routeRules = { '/api/**': { cors: true } }

      await extendRouteRules({ '/api/**': { prerender: true }, '/other/**': { ssr: false } })

      expect(mockNuxt.options.routeRules).toEqual({
        '/api/**': { cors: true, prerender: true },
        '/other/**': { ssr: false },
      })
    })
  })

  describe('with nitro initialized', () => {
    let updateConfigCalls: Array<{ routeRules: Record<string, any> }>

    beforeEach(() => {
      updateConfigCalls = []
      mockNuxt._nitro = {
        options: {
          routeRules: { '/existing/**': { cors: true } },
          _config: {
            routeRules: { '/existing/**': { cors: true } },
          },
        },
        updateConfig: (config: { routeRules: Record<string, any> }) => {
          updateConfigCalls.push(config)
        },
      }
    })

    it('calls nitro.updateConfig with merged rules', async () => {
      await extendRouteRules('/api/**', { prerender: true })

      expect(updateConfigCalls).toHaveLength(1)
      expect(updateConfigCalls[0]!.routeRules).toEqual({
        '/existing/**': { cors: true },
        '/api/**': { prerender: true },
      })
    })
  })
})

describe('extendRouteRules handle', () => {
  let updateConfigCalls: Array<{ routeRules: Record<string, any> }>

  beforeEach(() => {
    updateConfigCalls = []
    mockNuxt._nitro = {
      options: {
        routeRules: {},
        _config: {
          routeRules: { '/base/**': { ssr: true } },
        },
      },
      updateConfig: (config: { routeRules: Record<string, any> }) => {
        mockNuxt._nitro.options.routeRules = config.routeRules
        updateConfigCalls.push(config)
      },
    }
  })

  it('returns a handle with remove and replace', async () => {
    const handle = await extendRouteRules('/api/**', { cors: true })
    expect(typeof handle.remove).toBe('function')
    expect(typeof handle.replace).toBe('function')
  })

  it('remove() removes the rule from nitro', async () => {
    const handle = await extendRouteRules('/api/**', { cors: true })

    expect(updateConfigCalls).toHaveLength(1)
    expect(updateConfigCalls[0]!.routeRules).toEqual({
      '/base/**': { ssr: true },
      '/api/**': { cors: true },
    })

    await handle.remove()

    expect(updateConfigCalls).toHaveLength(2)
    expect(updateConfigCalls[1]!.routeRules).toEqual({
      '/base/**': { ssr: true },
    })
  })

  it('remove() is idempotent', async () => {
    const handle = await extendRouteRules('/api/**', { cors: true })

    await handle.remove()
    await handle.remove()
    await handle.remove()

    // Only 2 calls: one for add, one for first remove
    expect(updateConfigCalls).toHaveLength(2)
  })

  it('record signature returns handle for all entries', async () => {
    const handle = await extendRouteRules({
      '/api/**': { cors: true },
      '/static/**': { prerender: true },
    })

    // After record extend, last call should have all rules
    expect(updateConfigCalls.at(-1)!.routeRules).toEqual({
      '/base/**': { ssr: true },
      '/api/**': { cors: true },
      '/static/**': { prerender: true },
    })

    await handle.remove()

    // After remove, only base remains
    expect(updateConfigCalls.at(-1)!.routeRules).toEqual({
      '/base/**': { ssr: true },
    })
  })

  it('multiple handles work independently', async () => {
    const handle1 = await extendRouteRules('/api/**', { cors: true })
    const handle2 = await extendRouteRules('/static/**', { prerender: true })

    expect(updateConfigCalls.at(-1)!.routeRules).toEqual({
      '/base/**': { ssr: true },
      '/api/**': { cors: true },
      '/static/**': { prerender: true },
    })

    await handle1.remove()

    expect(updateConfigCalls.at(-1)!.routeRules).toEqual({
      '/base/**': { ssr: true },
      '/static/**': { prerender: true },
    })

    await handle2.remove()

    expect(updateConfigCalls.at(-1)!.routeRules).toEqual({
      '/base/**': { ssr: true },
    })
  })

  it('replace() replaces rules in single rebuild', async () => {
    const handle = await extendRouteRules({
      '/api/**': { cors: true },
    })

    const callsBefore = updateConfigCalls.length

    await handle.replace({
      '/api/**': { cors: false },
      '/new/**': { prerender: true },
    })

    // Only ONE additional call for replace (not two like remove+add)
    expect(updateConfigCalls.length).toBe(callsBefore + 1)

    expect(updateConfigCalls.at(-1)!.routeRules).toEqual({
      '/base/**': { ssr: true },
      '/api/**': { cors: false },
      '/new/**': { prerender: true },
    })
  })

  it('replace() can be called multiple times', async () => {
    const handle = await extendRouteRules({ '/api/**': { cors: true } })

    await handle.replace({ '/v2/**': { cors: true } })
    await handle.replace({ '/v3/**': { cors: true } })

    expect(updateConfigCalls.at(-1)!.routeRules).toEqual({
      '/base/**': { ssr: true },
      '/v3/**': { cors: true },
    })
  })
})

describe('extendRouteRules order/priority', () => {
  let updateConfigCalls: Array<{ routeRules: Record<string, any> }>

  beforeEach(() => {
    updateConfigCalls = []
    mockNuxt._nitro = {
      options: {
        routeRules: {},
        _config: {
          routeRules: {},
        },
      },
      updateConfig: (config: { routeRules: Record<string, any> }) => {
        mockNuxt._nitro.options.routeRules = config.routeRules
        updateConfigCalls.push(config)
      },
    }
  })

  it('higher order takes precedence', async () => {
    await extendRouteRules('/api/**', { cors: false }, { order: 0 })
    await extendRouteRules('/api/**', { cors: true }, { order: 10 })

    // order: 10 (higher) should override order: 0
    expect(updateConfigCalls.at(-1)!.routeRules).toEqual({
      '/api/**': { cors: true },
    })
  })

  it('lower order acts as base layer', async () => {
    await extendRouteRules('/api/**', { cors: true, prerender: true }, { order: 0 })
    await extendRouteRules('/api/**', { cors: false }, { order: 10 })

    // order: 10 overrides cors, but prerender from order: 0 is preserved
    expect(updateConfigCalls.at(-1)!.routeRules).toEqual({
      '/api/**': { cors: false, prerender: true },
    })
  })

  it('default order is 0', async () => {
    await extendRouteRules('/api/**', { cors: true })
    await extendRouteRules('/api/**', { cors: false }, { order: 1 })

    // order: 1 > default 0
    expect(updateConfigCalls.at(-1)!.routeRules).toEqual({
      '/api/**': { cors: false },
    })
  })

  it('remove() preserves priority order', async () => {
    await extendRouteRules('/api/**', { cors: true }, { order: 0 })
    const handle = await extendRouteRules('/api/**', { cors: false }, { order: 10 })
    await extendRouteRules('/api/**', { prerender: true }, { order: 5 })

    // Before remove: order 10 wins for cors
    expect(updateConfigCalls.at(-1)!.routeRules).toEqual({
      '/api/**': { cors: false, prerender: true },
    })

    await handle.remove()

    // After remove: order 5 wins over order 0 for cors (order 10 removed)
    expect(updateConfigCalls.at(-1)!.routeRules).toEqual({
      '/api/**': { cors: true, prerender: true },
    })
  })
})

describe('extendRouteRules inline rules simulation', () => {
  let updateConfigCalls: Array<{ routeRules: Record<string, any> }>

  beforeEach(() => {
    updateConfigCalls = []
    mockNuxt._nitro = {
      options: {
        routeRules: {},
        _config: {
          routeRules: { '/config/**': { ssr: true } },
        },
      },
      updateConfig: (config: { routeRules: Record<string, any> }) => {
        mockNuxt._nitro.options.routeRules = config.routeRules
        updateConfigCalls.push(config)
      },
    }
  })

  it('inline rules (order: 100) override module rules (order: 0)', async () => {
    // Module adds rules at default order (0)
    await extendRouteRules('/api/**', { cors: true, cache: { maxAge: 60 } })

    // Inline rules (pages) add rules at order: 100
    const inlineHandle = await extendRouteRules({ '/api/**': { cors: false } }, { order: 100 })

    // Inline (order: 100) overrides module (order: 0) for cors
    // But module's cache is preserved since inline doesn't set it
    expect(updateConfigCalls.at(-1)!.routeRules).toEqual({
      '/config/**': { ssr: true },
      '/api/**': { cors: false, cache: { maxAge: 60 } },
    })

    await inlineHandle.remove()

    // After inline removed, module rules are back
    expect(updateConfigCalls.at(-1)!.routeRules).toEqual({
      '/config/**': { ssr: true },
      '/api/**': { cors: true, cache: { maxAge: 60 } },
    })
  })

  it('inline rules replace() preserves module rules', async () => {
    // Module adds rules at default order (0)
    await extendRouteRules('/api/**', { cors: true })
    await extendRouteRules('/static/**', { prerender: true })

    // Inline rules (pages) add rules at order: 100
    const inlineHandle = await extendRouteRules({ '/page/**': { ssr: false } }, { order: 100 })

    expect(updateConfigCalls.at(-1)!.routeRules).toEqual({
      '/config/**': { ssr: true },
      '/api/**': { cors: true },
      '/static/**': { prerender: true },
      '/page/**': { ssr: false },
    })

    // Inline rules update (HMR scenario) - single rebuild
    const callsBefore = updateConfigCalls.length
    await inlineHandle.replace({ '/page/**': { ssr: true }, '/new-page/**': { cache: { maxAge: 30 } } })

    // Only one rebuild
    expect(updateConfigCalls.length).toBe(callsBefore + 1)

    // Module rules preserved, inline rules replaced
    expect(updateConfigCalls.at(-1)!.routeRules).toEqual({
      '/config/**': { ssr: true },
      '/api/**': { cors: true },
      '/static/**': { prerender: true },
      '/page/**': { ssr: true },
      '/new-page/**': { cache: { maxAge: 30 } },
    })
  })

  it('multiple replace() calls work correctly', async () => {
    // Module rules
    await extendRouteRules('/api/**', { cors: true })

    // Inline handle
    const inlineHandle = await extendRouteRules({ '/v1/**': { ssr: false } }, { order: 100 })

    // First HMR update
    await inlineHandle.replace({ '/v2/**': { ssr: false } })

    expect(updateConfigCalls.at(-1)!.routeRules).toEqual({
      '/config/**': { ssr: true },
      '/api/**': { cors: true },
      '/v2/**': { ssr: false },
    })

    // Second HMR update
    await inlineHandle.replace({ '/v3/**': { ssr: false }, '/v3/special/**': { cache: { maxAge: 60 } } })

    expect(updateConfigCalls.at(-1)!.routeRules).toEqual({
      '/config/**': { ssr: true },
      '/api/**': { cors: true },
      '/v3/**': { ssr: false },
      '/v3/special/**': { cache: { maxAge: 60 } },
    })

    // v1 and v2 should NOT be present
    expect(updateConfigCalls.at(-1)!.routeRules).not.toHaveProperty('/v1/**')
    expect(updateConfigCalls.at(-1)!.routeRules).not.toHaveProperty('/v2/**')
  })
})

describe('extendRouteRules + getRouteRules integration', () => {
  it('sees rules immediately after extending', async () => {
    await extendRouteRules('/api/**', { cors: true })
    expect(getRouteRules('/api/users')).toEqual({ cors: true })
  })

  it('sees multiple extended rules', async () => {
    await extendRouteRules({
      '/api/**': { cors: true },
      '/api/admin/**': { headers: { 'x-admin': 'true' } },
    })

    expect(getRouteRules('/api/users')).toEqual({ cors: true })
    expect(getRouteRules('/api/admin/dashboard')).toEqual({
      cors: true,
      headers: { 'x-admin': 'true' },
    })
  })

  it('sees rules extended dynamically', async () => {
    await extendRouteRules('/api/**', { cors: true })
    await extendRouteRules('/static/**', { prerender: true })

    expect(getRouteRules('/static/image.png')).toEqual({ prerender: true })
    expect(getRouteRules('/api/test')).toEqual({ cors: true })
  })

  it('invalidates cache when rules are added', async () => {
    // First call builds cache
    expect(getRouteRules('/api/test')).toEqual({})

    // Add rules - should invalidate cache
    await extendRouteRules('/api/**', { cors: true })

    // Should see new rules
    expect(getRouteRules('/api/test')).toEqual({ cors: true })
  })

  describe('with nitro initialized', () => {
    beforeEach(() => {
      mockNuxt._nitro = {
        options: {
          routeRules: {},
          _config: { routeRules: {} },
        },
        updateConfig: (config: { routeRules: Record<string, any> }) => {
          mockNuxt._nitro.options.routeRules = config.routeRules
        },
      }
    })

    it('invalidates cache when rules are removed', async () => {
      const handle = await extendRouteRules('/api/**', { cors: true })
      expect(getRouteRules('/api/test')).toEqual({ cors: true })

      await handle.remove()

      expect(getRouteRules('/api/test')).toEqual({})
    })

    it('invalidates cache when rules are replaced', async () => {
      const handle = await extendRouteRules('/api/**', { cors: true })
      expect(getRouteRules('/api/test')).toEqual({ cors: true })

      await handle.replace({ '/api/**': { cors: false, prerender: true } })

      expect(getRouteRules('/api/test')).toEqual({ cors: false, prerender: true })
    })
  })
})
