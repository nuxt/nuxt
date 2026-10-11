import { describe, expect, it } from 'vitest'
import type { EnvironmentModuleGraph } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { collectDevCss, collectSsrGraphCss } from '../src/vite.ts'

describe('collectSsrGraphCss and collectDevCss in nitro-server', () => {
  it('should deduplicate multiple moduleGraph entries pointing to the same file in SSR graph', () => {
    const moduleGraph = {
      urlToModuleMap: new Map([
        ['/@fs/workspace/layer/app/assets/css/tokens.css', { file: '/workspace/layer/app/assets/css/tokens.css', importers: new Set() }],
        ['/workspace/layer/app/assets/css/tokens.css', { file: '/workspace/layer/app/assets/css/tokens.css', importers: new Set() }],
        ['/assets/css/theme.css', { file: '/workspace/app/assets/css/theme.css', importers: new Set() }],
      ]),
    } as unknown as EnvironmentModuleGraph

    const { urls, files } = collectSsrGraphCss(moduleGraph)
    expect(urls).toEqual([
      '/@fs/workspace/layer/app/assets/css/tokens.css',
      '/assets/css/theme.css',
    ])
    expect(Array.from(files)).toEqual([
      '/workspace/layer/app/assets/css/tokens.css',
      '/workspace/app/assets/css/theme.css',
    ])
  })

  it('should not duplicate global css already covered by SSR graph', () => {
    const nuxt = {
      options: {
        css: ['/workspace/app/assets/css/global.css'],
        alias: {},
        modulesDir: [],
      },
    } as unknown as Nuxt

    const moduleGraph = {
      urlToModuleMap: new Map([
        ['/@fs/workspace/app/assets/css/global.css', { file: '/workspace/app/assets/css/global.css', importers: new Set() }],
      ]),
    } as unknown as EnvironmentModuleGraph

    expect(collectDevCss(nuxt, moduleGraph)).toEqual([
      '/@fs/workspace/app/assets/css/global.css',
    ])
  })
})
