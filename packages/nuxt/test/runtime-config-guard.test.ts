import { createSSRApp } from 'vue'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { guardedServerConfig as GuardedServerConfig } from '../src/app/internal/runtime-config.ts'
import type { createNuxtApp as CreateNuxtApp } from '../src/app/nuxt.ts'

const captureStackTrace = vi.hoisted(() => vi.fn(() => [] as Array<{ source: string, line?: number, column?: number }>))

vi.mock('errx', () => ({ captureStackTrace }))

let guardedServerConfig: typeof GuardedServerConfig
let createNuxtApp: typeof CreateNuxtApp

beforeAll(async () => {
  vi.stubGlobal('__TEST_DEV__', true)
  vi.stubGlobal('__TEST_SERVER__', true)
  vi.stubGlobal('__TEST_TEST__', true)
  vi.stubGlobal('__NUXT_ASYNC_CONTEXT__', false)
  ;({ guardedServerConfig } = await import('../src/app/internal/runtime-config.ts'))
  ;({ createNuxtApp } = await import('../src/app/nuxt.ts'))
})

afterAll(() => {
  vi.unstubAllGlobals()
})

// reports are deduplicated by key path for the whole module, so each test uses its own keys
function captureReports () {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  return () => warn.mock.calls.map(args => args.join(' ')).filter(message => message.includes('NUXT_E1014'))
}

describe('server runtime config mutation guard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('guards `$config` on a server-rendered app', () => {
    const reports = captureReports()
    const runtimeConfig = { public: { appWideKey: 'a' }, app: {} }
    const nuxtApp = createNuxtApp({ vueApp: createSSRApp({}), ssrContext: { runtimeConfig, payload: {} } as any })

    ;(nuxtApp.$config.public as any).appWideKey = 'b'

    expect(runtimeConfig.public.appWideKey).toBe('b')
    expect(reports()).toHaveLength(1)
    expect(reports()[0]).toContain('`public.appWideKey` was mutated on the server during a request.')
  })

  it('includes the user stack trace', () => {
    const reports = captureReports()
    captureStackTrace.mockReturnValueOnce([{ source: 'file:///project/app/app.vue', line: 3, column: 15 }])
    const config = guardedServerConfig({ public: { tracedKey: 'a' } })

    ;(config.public as any).tracedKey = 'b'

    expect(reports()[0]).toContain('at /project/app/app.vue:3:15')
  })

  it('reads through to the underlying config', () => {
    const config = guardedServerConfig({ apiSecret: 'shh', public: { base: '/api' } })

    expect(config.apiSecret).toBe('shh')
    expect((config.public as any).base).toBe('/api')
  })

  it('returns a stable proxy for nested objects', () => {
    const config = guardedServerConfig({ public: { nested: {} } })

    expect(config.public).toBe(config.public)
    expect((config.public as any).nested).toBe((config.public as any).nested)
  })

  it('leaves non-plain values untouched', () => {
    const date = new Date()
    const config = guardedServerConfig({ public: { date } })

    expect((config.public as any).date).toBe(date)
  })

  it('returns frozen objects as they are', () => {
    const frozen = Object.freeze({ deep: 1 })
    const config = guardedServerConfig({ public: { frozen } })

    expect((config.public as any).frozen).toBe(frozen)
  })

  it('returns non-writable, non-configurable values as they are', () => {
    const locked = { deep: 1 }
    const publicConfig = Object.defineProperty({}, 'locked', { value: locked, writable: false, configurable: false })
    const config = guardedServerConfig({ public: publicConfig })

    expect((config.public as any).locked).toBe(locked)
  })

  it('reports mutations of values behind non-configurable getters', () => {
    const reports = captureReports()
    const value = { getterKey: 1 }
    const publicConfig = Object.defineProperty({}, 'computed', { get: () => value, configurable: false })
    const config = guardedServerConfig({ public: publicConfig })

    ;(config.public as any).computed.getterKey = 2

    expect(value.getterKey).toBe(2)
    expect(reports()).toHaveLength(1)
    expect(reports()[0]).toContain('`public.computed.getterKey`')
  })

  it('does not report reads', () => {
    const reports = captureReports()
    const config = guardedServerConfig({ public: { readOnly: { deep: 1 } } })

    expect((config.public as any).readOnly.deep).toBe(1)
    expect(reports()).toHaveLength(0)
  })

  it('reports a nested mutation and still applies it', () => {
    const reports = captureReports()
    const target = { public: { nestedFlag: false } }
    const config = guardedServerConfig(target)

    ;(config.public as any).nestedFlag = true

    expect(target.public.nestedFlag).toBe(true)
    expect(reports()).toHaveLength(1)
    expect(reports()[0]).toContain('`public.nestedFlag`')
  })

  it('reports a top-level mutation', () => {
    const reports = captureReports()
    const target = { topLevelSecret: 'shh' }
    const config = guardedServerConfig(target)

    config.topLevelSecret = 'leaked'

    expect(target.topLevelSecret).toBe('leaked')
    expect(reports()).toHaveLength(1)
    expect(reports()[0]).toContain('`topLevelSecret`')
  })

  it('reports mutations of null-prototype objects', () => {
    const reports = captureReports()
    const target = { public: Object.assign(Object.create(null), { nullProtoKey: 1 }) }
    const config = guardedServerConfig(target)

    ;(config.public as any).nullProtoKey = 2

    expect(target.public.nullProtoKey).toBe(2)
    expect(reports()).toHaveLength(1)
    expect(reports()[0]).toContain('`public.nullProtoKey`')
  })

  it('reports deletions', () => {
    const reports = captureReports()
    const target: Record<string, any> = { public: { deletedKey: 1 } }
    const config = guardedServerConfig(target)

    delete (config.public as any).deletedKey

    expect(target.public.deletedKey).toBeUndefined()
    expect(reports()).toHaveLength(1)
    expect(reports()[0]).toContain('`public.deletedKey`')
  })

  it('reports properties defined with `Object.defineProperty`', () => {
    const reports = captureReports()
    const target: Record<string, any> = { public: {} }
    const config = guardedServerConfig(target)

    Object.defineProperty(config.public, 'definedKey', { value: 1 })

    expect(target.public.definedKey).toBe(1)
    expect(reports()).toHaveLength(1)
    expect(reports()[0]).toContain('`public.definedKey`')
  })

  it('reports an array mutation once, by the path of the array', () => {
    const reports = captureReports()
    const target = { public: { pushedList: ['a'] } }
    const config = guardedServerConfig(target)

    ;(config.public as any).pushedList.push('b')

    expect(target.public.pushedList).toEqual(['a', 'b'])
    expect(reports()).toHaveLength(1)
    expect(reports()[0]).toContain('`public.pushedList` was mutated')
  })

  it('stores the underlying value when a guarded value is written back', () => {
    captureReports()
    const item = { name: 'a' }
    const target = { public: { item, other: null as unknown } }
    const config = guardedServerConfig(target)

    ;(config.public as any).other = (config.public as any).item

    expect(target.public.other).toBe(item)
  })

  it('defines locked properties from guarded values', () => {
    captureReports()
    const config = guardedServerConfig({ public: { lockedSource: {} } })
    const source = (config.public as any).lockedSource

    expect(() => Object.defineProperty(config.public, 'lockedAlias', { value: source })).not.toThrow()
    expect(() => Object.defineProperty(config.public, 'lockedExplicit', { value: source, writable: false, configurable: false })).not.toThrow()
  })

  it('does not nest guards from earlier requests', () => {
    const reports = captureReports()
    const target = { public: { sourceList: [{ name: 'a' }], copiedList: [] as unknown[] } }
    const firstRequest = guardedServerConfig(target)
    ;(firstRequest.public as any).copiedList = [...(firstRequest.public as any).sourceList]

    const secondRequest = guardedServerConfig(target)
    ;(secondRequest.public as any).copiedList[0].name = 'b'

    expect(target.public.sourceList[0]!.name).toBe('b')
    expect(reports().filter(message => message.includes('.0.name'))).toHaveLength(1)
    expect(reports().at(-1)).toContain('`public.copiedList.0.name`')
  })

  it('reports each key path once across requests, but distinct paths separately', () => {
    const reports = captureReports()
    const config = guardedServerConfig({ public: { counterA: 0, counterB: 0 } })

    ;(config.public as any).counterA = 1
    ;(config.public as any).counterA = 2
    ;(config.public as any).counterA = 3
    expect(reports()).toHaveLength(1)

    ;(config.public as any).counterB = 1
    expect(reports()).toHaveLength(2)

    const nextRequestConfig = guardedServerConfig({ public: { counterA: 0 } })
    ;(nextRequestConfig.public as any).counterA = 4
    expect(reports()).toHaveLength(2)
  })
})
