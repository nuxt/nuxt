import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import type { EnvironmentModuleGraph } from 'vite'
import { collectDevCss, toFsUrl } from '../src/utils/css.ts'

describe('toFsUrl', () => {
  it('should prefix a posix path', () => {
    expect(toFsUrl('/project/packages/nuxt/src/app/entry.async.ts')).toBe('/@fs/project/packages/nuxt/src/app/entry.async.ts')
  })

  it('should keep a separator before a windows drive letter', () => {
    expect(toFsUrl('D:/project/packages/nuxt/src/app/entry.async.ts')).toBe('/@fs/D:/project/packages/nuxt/src/app/entry.async.ts')
  })
})

describe('collectDevCss', () => {
  const nuxt = { options: { css: [], alias: {}, modulesDir: [] } } as unknown as Nuxt

  function graph (urls: string[]) {
    return { urlToModuleMap: new Map(urls.map(url => [url, { importers: new Set() }])) } as unknown as EnvironmentModuleGraph
  }

  it('should link a module registered under several urls once', () => {
    const tokens = { file: '/layer/tokens.css', importers: new Set() }
    const theme = { file: '/app/theme.css', importers: new Set() }
    const urlToModuleMap = new Map([
      ['/@fs/layer/tokens.css', tokens],
      ['/theme.css', theme],
      ['/layer/tokens.css', tokens],
    ])
    expect(collectDevCss(nuxt, { urlToModuleMap } as unknown as EnvironmentModuleGraph)).toEqual([
      '/@fs/layer/tokens.css',
      '/theme.css',
    ])
  })

  it('should link every style block of a component', () => {
    const urlToModuleMap = new Map([
      ['/app.vue?vue&type=style&index=0&lang.css', { file: '/app/app.vue', importers: new Set() }],
      ['/app.vue?vue&type=style&index=1&lang.css', { file: '/app/app.vue', importers: new Set() }],
    ])
    expect(collectDevCss(nuxt, { urlToModuleMap } as unknown as EnvironmentModuleGraph)).toEqual([
      '/app.vue?vue&type=style&index=0&lang.css',
      '/app.vue?vue&type=style&index=1&lang.css',
    ])
  })

  it('should serve non-path ids from `/@id/`', () => {
    expect(collectDevCss(nuxt, graph([
      '/assets/main.css',
      '/@fs/project/assets/main.css',
      '/@id/__x00__/already-wrapped.css',
      '\0/__uno.css',
      'virtual:theme.css',
    ]))).toEqual([
      '/assets/main.css',
      '/@fs/project/assets/main.css',
      '/@id/__x00__/already-wrapped.css',
      '/@id/__x00__/__uno.css',
      '/@id/virtual:theme.css',
    ])
  })
})
