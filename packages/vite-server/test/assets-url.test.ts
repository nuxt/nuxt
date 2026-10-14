import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import type { Plugin, UserConfig } from 'vite'

import { ScopedAssetsURLPlugin, assetsURLGlobal } from '../src/ssr.ts'
import { createRendererOptions } from '../src/runtime/renderer.ts'

type RenderBuiltUrl = NonNullable<NonNullable<UserConfig['experimental']>['renderBuiltUrl']>

// the expressions `@nuxt/vite` emits for an asset referenced from a server chunk
const nuxtRenderBuiltUrl: RenderBuiltUrl = (filename, { type, ssr }) => {
  if (!ssr) {
    return type === 'asset' ? { relative: true } : { runtime: `globalThis.__publicAssetsURL(${JSON.stringify(filename)})` }
  }
  return type === 'public'
    ? { runtime: `__publicAssetsURL(${JSON.stringify(filename)})` }
    : { runtime: `globalThis.__buildAssetsURL(${JSON.stringify(filename)})` }
}

function createNuxt (buildDir: string, buildId: string): Nuxt {
  return { options: { buildDir, buildId } } as Nuxt
}

function configure (nuxt: Nuxt, renderBuiltUrl: RenderBuiltUrl = nuxtRenderBuiltUrl): RenderBuiltUrl {
  const plugin = ScopedAssetsURLPlugin(nuxt) as Plugin
  const config: UserConfig = { experimental: { renderBuiltUrl } }
  ;(plugin.config as (config: UserConfig) => void)(config)
  return config.experimental!.renderBuiltUrl!
}

const context = (ssr: boolean, type: 'asset' | 'public') => ({ ssr, type, hostId: 'chunk.mjs', hostType: 'js' as const })

describe('asset URLs in the server build', () => {
  it('resolves them through a global scoped to the build', () => {
    const nuxt = createNuxt('/a/.nuxt', 'build')
    const key = JSON.stringify(assetsURLGlobal(nuxt))
    const render = configure(nuxt)

    expect(render('logo.svg', context(true, 'asset'))).toEqual({ runtime: `globalThis[${key}].buildAssetsURL("logo.svg")` })
    expect(render('robots.txt', context(true, 'public'))).toEqual({ runtime: `globalThis[${key}].publicAssetsURL("robots.txt")` })
  })

  it('scopes apps sharing a pinned build id apart', () => {
    expect(assetsURLGlobal(createNuxt('/a/.nuxt', 'abc123'))).not.toBe(assetsURLGlobal(createNuxt('/b/.nuxt', 'abc123')))
    expect(assetsURLGlobal(createNuxt('/a/.nuxt', 'abc123'))).toBe(assetsURLGlobal(createNuxt('/a/.nuxt', 'abc123')))
  })

  it('leaves the client build alone', () => {
    const render = configure(createNuxt('/a/.nuxt', 'build'))

    expect(render('logo.svg', context(false, 'asset'))).toEqual({ relative: true })
    expect(render('robots.txt', context(false, 'public'))).toEqual({ runtime: 'globalThis.__publicAssetsURL("robots.txt")' })
  })

  it('installs the helpers of each build under its own key', () => {
    createRendererOptions(() => ({}) as never, () => ({}), undefined, '__nuxt_assets:build-a')
    const a = (globalThis as Record<string, unknown>)['__nuxt_assets:build-a']
    createRendererOptions(() => ({}) as never, () => ({}), undefined, '__nuxt_assets:build-b')

    expect(a).toMatchObject({ buildAssetsURL: expect.any(Function) })
    expect((globalThis as Record<string, unknown>)['__nuxt_assets:build-a']).toBe(a)
    expect((globalThis as Record<string, unknown>)['__nuxt_assets:build-b']).not.toBe(a)
  })
})
