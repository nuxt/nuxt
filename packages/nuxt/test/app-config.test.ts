import { beforeEach, describe, expect, it, vi } from 'vitest'
import { _replaceAppConfig } from '../src/app/config.ts'

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
