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
