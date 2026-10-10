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
  const createMockNuxt = (options: { css?: string[], alias?: Record<string, string>, modulesDir?: string[] } = {}): Nuxt => ({
    options: {
      css: options.css || [],
      alias: options.alias || {},
      modulesDir: options.modulesDir || [],
    },
  } as unknown as Nuxt)

  it('should deduplicate multiple URLs pointing to the same module node and preserve cascade order', () => {
    const layerNode = {
      url: '/@fs/path/to/layer/tokens.css',
      file: '/path/to/layer/tokens.css',
      id: '/path/to/layer/tokens.css',
    }
    const appNode = {
      url: '/assets/theme.css',
      file: '/path/to/app/assets/theme.css',
      id: '/path/to/app/assets/theme.css',
    }
    const urlToModuleMap = new Map([
      ['/@fs/path/to/layer/tokens.css', layerNode],
      ['/assets/theme.css', appNode],
      ['/path/to/layer/tokens.css', layerNode], // duplicate non-@fs URL pointing to layerNode
    ])

    const result = collectDevCss(createMockNuxt(), { urlToModuleMap } as unknown as EnvironmentModuleGraph)
    expect(result).toEqual([
      'asserts layer css comes first before app css',
      '/@fs/path/to/layer/tokens.css',
      '/assets/theme.css',
    ].slice(1))
  })

  it('should deduplicate duplicate URLs for Vue SFC style blocks', () => {
    const sfcStyleNode = {
      url: '/@fs/path/to/layer/Badge.vue?vue&type=style&index=0&scoped=c6f20af9&lang.css',
      file: '/path/to/layer/Badge.vue',
      id: '/path/to/layer/Badge.vue?vue&type=style&index=0&scoped=c6f20af9&lang.css',
    }
    const urlToModuleMap = new Map([
      ['/@fs/path/to/layer/Badge.vue?vue&type=style&index=0&scoped=c6f20af9&lang.css', sfcStyleNode],
      ['/path/to/layer/Badge.vue?vue&type=style&index=0&scoped=c6f20af9&lang.css', sfcStyleNode],
    ])

    const result = collectDevCss(createMockNuxt(), { urlToModuleMap } as unknown as EnvironmentModuleGraph)
    expect(result).toEqual([
      '/@fs/path/to/layer/Badge.vue?vue&type=style&index=0&scoped=c6f20af9&lang.css',
    ])
  })

  it('should keep distinct <style> blocks in the same Vue component', () => {
    const style0 = {
      url: '/@fs/path/to/Badge.vue?vue&type=style&index=0&scoped=c6f20af9&lang.css',
      file: '/path/to/Badge.vue',
      id: '/path/to/Badge.vue?vue&type=style&index=0&scoped=c6f20af9&lang.css',
    }
    const style1 = {
      url: '/@fs/path/to/Badge.vue?vue&type=style&index=1&lang.css',
      file: '/path/to/Badge.vue',
      id: '/path/to/Badge.vue?vue&type=style&index=1&lang.css',
    }
    const urlToModuleMap = new Map([
      ['/@fs/path/to/Badge.vue?vue&type=style&index=0&scoped=c6f20af9&lang.css', style0],
      ['/@fs/path/to/Badge.vue?vue&type=style&index=1&lang.css', style1],
    ])

    const result = collectDevCss(createMockNuxt(), { urlToModuleMap } as unknown as EnvironmentModuleGraph)
    expect(result).toEqual([
      '/@fs/path/to/Badge.vue?vue&type=style&index=0&scoped=c6f20af9&lang.css',
      '/@fs/path/to/Badge.vue?vue&type=style&index=1&lang.css',
    ])
  })

  it('should deduplicate separate module nodes referencing the same physical CSS file', () => {
    const nodeA = {
      file: '/path/to/tokens.css',
      id: '/path/to/tokens.css',
    }
    const nodeB = {
      file: '/path/to/tokens.css',
      id: 'tokens.css',
    }
    const urlToModuleMap = new Map([
      ['/@fs/path/to/tokens.css', nodeA],
      ['/tokens.css', nodeB],
    ])

    const result = collectDevCss(createMockNuxt(), { urlToModuleMap } as unknown as EnvironmentModuleGraph)
    expect(result).toEqual(['/@fs/path/to/tokens.css'])
  })

  it('should not duplicate global CSS entries that are already in the module graph', () => {
    const globalCssFile = '/project/assets/global.css'
    const nuxt = createMockNuxt({ css: [globalCssFile] })
    const node = {
      file: globalCssFile,
      id: globalCssFile,
    }
    const urlToModuleMap = new Map([
      ['/assets/global.css', node],
    ])

    const result = collectDevCss(nuxt, { urlToModuleMap } as unknown as EnvironmentModuleGraph)
    expect(result).toEqual(['/assets/global.css'])
  })

  it('should include global CSS entries that are not yet loaded in the module graph', () => {
    const globalCssFile = '/project/assets/global.css'
    const nuxt = createMockNuxt({ css: [globalCssFile] })
    const urlToModuleMap = new Map()

    const result = collectDevCss(nuxt, { urlToModuleMap } as unknown as EnvironmentModuleGraph)
    expect(result).toEqual(['/@fs/project/assets/global.css'])
  })

  it('should filter out raw css and css imported only by raw modules', () => {
    const urlToModuleMap = new Map([
      ['/assets/style.css?raw', { file: '/assets/style.css', id: '/assets/style.css?raw' }],
      ['/assets/raw-importer.css', {
        file: '/assets/raw-importer.css',
        id: '/assets/raw-importer.css',
        importers: new Set([{ id: '/app.vue?raw' }]),
      }],
    ])

    const result = collectDevCss(createMockNuxt(), { urlToModuleMap } as unknown as EnvironmentModuleGraph)
    expect(result).toEqual([])
  })
})
