import { afterEach, describe, expect, it } from 'vitest'

import { setAssetURLGlobals } from '../src/runtime/utils/renderer/asset-url-globals'

describe('asset url globals', () => {
  const originalBuildAssetsURL = (globalThis as any).__buildAssetsURL
  const originalPublicAssetsURL = (globalThis as any).__publicAssetsURL

  afterEach(() => {
    ;(globalThis as any).__buildAssetsURL = originalBuildAssetsURL
    ;(globalThis as any).__publicAssetsURL = originalPublicAssetsURL
  })

  it('sets global helpers used by vite-generated server chunks', () => {
    const buildAssetsURL = (path: string) => '/_nuxt/' + path
    const publicAssetsURL = (path: string) => '/public/' + path

    setAssetURLGlobals(buildAssetsURL, publicAssetsURL)

    expect((globalThis as any).__buildAssetsURL).toBe(buildAssetsURL)
    expect((globalThis as any).__publicAssetsURL).toBe(publicAssetsURL)
    expect((globalThis as any).__buildAssetsURL('entry.js')).toBe('/_nuxt/entry.js')
    expect((globalThis as any).__publicAssetsURL('logo.svg')).toBe('/public/logo.svg')
  })
})
