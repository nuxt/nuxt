import { describe, expect, it } from 'vitest'

describe('runtimeConfig schema resolution', () => {
  it('preserves null values and falls back undefined to empty string', async () => {
    const common = (await import('../src/config/common.ts')).default
    const resolvedDirect = await common.runtimeConfig.$resolve({
      val1: null,
      val2: undefined,
      val3: 0,
      val4: '',
      public: {
        nestedNull: null,
        nestedUndefined: undefined,
        nestedString: 'hello',
      },
    }, (key: string) => {
      if (key === 'app') {
        return { baseURL: '/base/', buildAssetsDir: '/_nuxt/', cdnURL: '' }
      }
      if (key === 'buildId') {
        return 'test'
      }
      return undefined
    })

    expect(resolvedDirect.val1).toBe(null)
    expect(resolvedDirect.val2).toBe('')
    expect(resolvedDirect.val3).toBe(0)
    expect(resolvedDirect.val4).toBe('')
    expect(resolvedDirect.public.nestedNull).toBe(null)
    expect(resolvedDirect.public.nestedUndefined).toBe('')
    expect(resolvedDirect.public.nestedString).toBe('hello')
  })

  it('normalizes reserved app URL fields when provided with null and preserves empty string', async () => {
    const common = (await import('../src/config/common.ts')).default
    const resolved = await common.runtimeConfig.$resolve({
      app: {
        baseURL: null,
        buildAssetsDir: null,
        cdnURL: '',
      },
    }, (key: string) => {
      if (key === 'app') {
        return { baseURL: '/custom-base/', buildAssetsDir: '/custom-assets/', cdnURL: 'https://cdn.example.com' }
      }
      return undefined
    })

    expect(resolved.app.baseURL).toBe('/custom-base/')
    expect(resolved.app.buildAssetsDir).toBe('/custom-assets/')
    expect(resolved.app.cdnURL).toBe('')
  })

  it('keeps app namespace as an object when runtimeConfig.app is null', async () => {
    const common = (await import('../src/config/common.ts')).default
    const resolved = await common.runtimeConfig.$resolve({
      app: null,
    }, (key: string) => {
      if (key === 'app') {
        return { baseURL: '/fallback/', buildAssetsDir: '/_nuxt/', cdnURL: '' }
      }
      if (key === 'buildId') {
        return 'fallback-build-id'
      }
      return undefined
    })

    expect(resolved.app).toBeTypeOf('object')
    expect(resolved.app.baseURL).toBe('/fallback/')
    expect(resolved.app.buildId).toBe('fallback-build-id')
  })

  it('safely ignores unsafe prototype keys while allowing prototype and constructor null', async () => {
    const common = (await import('../src/config/common.ts')).default
    const inputWithProto = JSON.parse('{"__proto__":{"polluted":null},"custom":null,"prototype":null,"constructor":null}')

    const resolved = await common.runtimeConfig.$resolve(inputWithProto, (key: string) => {
      if (key === 'app') {
        return { baseURL: '/', buildAssetsDir: '/_nuxt/', cdnURL: '' }
      }
      return undefined
    })

    expect(resolved.custom).toBe(null)
    expect(resolved.prototype).toBe(null)
    expect(resolved.constructor).toBe(null)
    expect(Object.prototype.hasOwnProperty.call(Object.prototype, 'polluted')).toBe(false)
  })

  it('keeps public namespace as an object when runtimeConfig.public is null', async () => {
    const common = (await import('../src/config/common.ts')).default
    const resolved = await common.runtimeConfig.$resolve({
      public: null,
    }, (key: string) => {
      if (key === 'app') {
        return { baseURL: '/', buildAssetsDir: '/_nuxt/', cdnURL: '' }
      }
      return undefined
    })

    expect(resolved.public).toBeTypeOf('object')
    expect(resolved.public).toEqual({})
  })
})
