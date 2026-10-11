import { describe, expect, it } from 'vitest'
import type { EnvironmentModuleGraph } from 'vite'
import type { Nuxt } from '@nuxt/schema'
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
  it('should deduplicate multiple moduleGraph entries pointing to the same file', () => {
    const nuxt = {
      options: {
        css: [],
        alias: {},
        modulesDir: [],
      },
    } as unknown as Nuxt

    const moduleGraph = {
      urlToModuleMap: new Map([
        ['/@fs/workspace/layer/app/assets/css/tokens.css', { file: '/workspace/layer/app/assets/css/tokens.css', importers: new Set() }],
        ['/workspace/layer/app/assets/css/tokens.css', { file: '/workspace/layer/app/assets/css/tokens.css', importers: new Set() }],
        ['/assets/css/theme.css', { file: '/workspace/app/assets/css/theme.css', importers: new Set() }],
      ]),
    } as unknown as EnvironmentModuleGraph

    expect(collectDevCss(nuxt, moduleGraph)).toEqual([
      '/@fs/workspace/layer/app/assets/css/tokens.css',
      '/assets/css/theme.css',
    ])
  })

  it('should not re-add global css if already covered in moduleGraph', () => {
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
