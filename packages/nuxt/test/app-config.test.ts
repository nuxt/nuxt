import { beforeEach, describe, expect, it, vi } from 'vitest'
import { _getAppConfigDiff, _getServerAppConfig, _replaceAppConfig } from '../src/app/config.ts'
import __appConfig from '#build/app.config.mjs'

const mockNuxt = {
  _appConfig: {} as Partial<{
    apiUrl: string
    featureFlags: Record<string, boolean>
    entries: Array<{ label: string }>
  }>,
}

vi.mock('../src/app/nuxt', () => ({
  useNuxtApp: () => mockNuxt,
}))

describe('_replaceAppConfig', () => {
  beforeEach(() => {
    mockNuxt._appConfig = {
      apiUrl: 'https://api.example.com',
      featureFlags: { foo: false },
      entries: [{ label: 'foo' }, { label: 'bar' }],
    }
  })

  it('should remove properties not in new config', () => {
    const newConfig = {
      featureFlags: { baz: true },
      entries: [{ label: 'baz' }],
    }

    _replaceAppConfig(newConfig)
    expect(mockNuxt._appConfig).toEqual({
      featureFlags: { baz: true },
      entries: [{ label: 'baz' }],
    })
  })

  it('should add new properties from new config', () => {
    const newConfig = {
      apiUrl: 'https://api.newexample.com',
      featureFlags: { foo: true, baz: true },
      entries: [{ label: 'foo' }, { label: 'bar' }, { label: 'baz' }],
    }

    _replaceAppConfig(newConfig)

    expect(mockNuxt._appConfig).toEqual({
      apiUrl: 'https://api.newexample.com',
      featureFlags: { foo: true, baz: true },
      entries: [{ label: 'foo' }, { label: 'bar' }, { label: 'baz' }],
    })

    expect(mockNuxt._appConfig.entries?.length).toEqual(3)
  })

  it('should update properties in arrays', () => {
    const newConfig = {
      entries: [{ label: 'updated-foo' }, { label: 'updated-bar' }],
    }

    _replaceAppConfig(newConfig)

    expect(mockNuxt._appConfig.entries).toEqual([
      { label: 'updated-foo' },
      { label: 'updated-bar' },
    ])
  })

  it('should handle replacing arrays with objects and vice versa', () => {
    const newConfig = {
      entries: { first: { label: 'only-entry' } },
    }

    _replaceAppConfig(newConfig)

    expect(mockNuxt._appConfig.entries).toEqual({ first: { label: 'only-entry' } })

    const anotherNewConfig = {
      entries: [{ label: 'restored-entry' }],
    }

    _replaceAppConfig(anotherNewConfig)

    expect(mockNuxt._appConfig.entries).toEqual([{ label: 'restored-entry' }])
  })

  it('should preserve element order in arrays', () => {
    const newConfig = {
      entries: [{ label: 'foo' }, { label: 'baz' }, { label: 'bar' }],
    }

    _replaceAppConfig(newConfig)

    expect(mockNuxt._appConfig.entries).toEqual([
      { label: 'foo' },
      { label: 'baz' },
      { label: 'bar' },
    ])
  })

  it('should preserve object references for unchanged properties', () => {
    const originalFeatureFlags = mockNuxt._appConfig.featureFlags
    const newConfig = {
      apiUrl: 'https://api.example.com',
      featureFlags: { foo: false }, // unchanged
      entries: [{ label: 'new-entry' }],
    }

    _replaceAppConfig(newConfig)

    expect(mockNuxt._appConfig.featureFlags).toBe(originalFeatureFlags)
  })

  it('should preserve object references in arrays for unchanged elements', () => {
    const originalEntries = mockNuxt._appConfig.entries
    const newConfig = {
      entries: [originalEntries![0], { label: 'new-bar' }],
    }

    _replaceAppConfig(newConfig)

    expect(mockNuxt._appConfig.entries![0]).toBe(originalEntries![0])
  })
})

describe('_getAppConfigDiff', () => {
  const reference = {
    apiUrl: 'https://api.example.com',
    theme: { color: 'green', dark: { accent: 'blue' } },
    flags: { foo: false },
    entries: ['a', 'b'],
  }

  it('returns undefined when the config is unchanged', () => {
    expect(_getAppConfigDiff(structuredClone(reference), reference)).toBeUndefined()
  })

  it('carries a changed primitive value', () => {
    expect(_getAppConfigDiff({ ...reference, apiUrl: 'https://api.new.com' }, reference)).toEqual({
      apiUrl: 'https://api.new.com',
    })
  })

  it('carries a change deep within a nested object', () => {
    const current = structuredClone(reference)
    current.theme.dark.accent = 'red'
    expect(_getAppConfigDiff(current, reference)).toEqual({
      theme: { dark: { accent: 'red' } },
    })
  })

  it('carries added keys', () => {
    expect(_getAppConfigDiff({ ...reference, added: { deep: 1 } }, reference)).toEqual({
      added: { deep: 1 },
    })
  })

  it('carries an array when its values change', () => {
    expect(_getAppConfigDiff({ ...reference, entries: ['a', 'c'] }, reference)).toEqual({
      entries: ['a', 'c'],
    })
  })

  it('carries an array when its length changes', () => {
    expect(_getAppConfigDiff({ ...reference, entries: ['a', 'b', 'c'] }, reference)).toEqual({
      entries: ['a', 'b', 'c'],
    })
  })

  it('carries a value whose type changes', () => {
    expect(_getAppConfigDiff({ ...reference, flags: ['foo'] }, reference)).toEqual({
      flags: ['foo'],
    })
  })

  it('does not carry functions, which cannot be serialized into the payload', () => {
    const current = { ...reference, fn: () => {} }
    expect(_getAppConfigDiff(current, reference)).toBeUndefined()
  })

  it('only carries the changed subtree of a nested object', () => {
    const current = structuredClone(reference)
    current.theme.color = 'red'
    expect(_getAppConfigDiff(current, reference)).toEqual({
      theme: { color: 'red' },
    })
    expect(_getAppConfigDiff(current, reference)).not.toHaveProperty('theme.dark')
  })
})

describe('_getServerAppConfig', () => {
  it('returns the build-time config when the request made no changes', () => {
    const config = _getServerAppConfig({ ssrContext: {} })
    expect(config).not.toBe(__appConfig)
    expect(_getAppConfigDiff(config)).toBeUndefined()
  })

  it('applies changes made by server code for the current request', () => {
    const config = _getServerAppConfig({
      ssrContext: { appConfig: { theme: { color: 'red' }, newer: true } },
    })
    expect(config).toEqual({ theme: { color: 'red' }, newer: true })
  })

  it('keeps build-time keys the request changes did not touch', () => {
    const config = _getServerAppConfig({
      ssrContext: { appConfig: { theme: { color: 'red' } } },
    }) as { theme: { color: string }, apiUrl?: string }
    expect(config.theme.color).toBe('red')
  })

  it('does not mutate the app config of the request that provided the changes', () => {
    const eventConfig = { theme: { color: 'red' } }
    const config = _getServerAppConfig({ ssrContext: { appConfig: eventConfig } }) as { theme: { color: string } }
    config.theme.color = 'blue'
    expect(eventConfig.theme.color).toBe('red')
  })
})
