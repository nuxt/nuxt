import { join } from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getOptimizeDepsEntries } from '../src/shared/client.ts'

vi.mock('@nuxt/kit', () => ({
  getLayerDirectories: vi.fn(),
}))

const { getLayerDirectories } = await import('@nuxt/kit')

describe('getOptimizeDepsEntries (#28631)', () => {
  const mainEntry = '/project/.nuxt/entry.mjs'

  beforeEach(() => {
    vi.mocked(getLayerDirectories).mockReturnValue([])
  })

  it('includes main entry only when no layers', () => {
    const nuxt = {
      options: {
        rootDir: '/project',
        srcDir: '/project/app',
      },
    } as any

    const entries = getOptimizeDepsEntries(nuxt, mainEntry)

    expect(entries).toEqual([mainEntry])
  })

  it('does not add glob for main app layer (same as srcDir)', () => {
    const nuxt = {
      options: {
        rootDir: '/project',
        srcDir: '/project/app',
      },
    } as any
    vi.mocked(getLayerDirectories).mockReturnValue([
      { app: '/project/app', root: '/project' } as any,
    ])

    const entries = getOptimizeDepsEntries(nuxt, mainEntry)

    expect(entries).toEqual([mainEntry])
  })

  it('does not add glob for layer inside rootDir', () => {
    const nuxt = {
      options: {
        rootDir: '/project',
        srcDir: '/project/app',
      },
    } as any
    vi.mocked(getLayerDirectories).mockReturnValue([
      { app: '/project/app', root: '/project' } as any,
      { app: '/project/node_modules/my-layer/app', root: '/project/node_modules/my-layer' } as any,
    ])

    const entries = getOptimizeDepsEntries(nuxt, mainEntry)

    expect(entries).toEqual([mainEntry])
  })

  it('adds glob for external layer (app dir outside rootDir)', () => {
    const nuxt = {
      options: {
        rootDir: '/project',
        srcDir: '/project/app',
      },
    } as any
    const externalApp = '/other/layer/app'
    vi.mocked(getLayerDirectories).mockReturnValue([
      { app: '/project/app', root: '/project' } as any,
      { app: externalApp, root: '/other/layer' } as any,
    ])

    const entries = getOptimizeDepsEntries(nuxt, mainEntry)

    expect(entries).toEqual([
      mainEntry,
      join(externalApp, '**/*.{vue,ts,tsx,js,jsx,mjs}'),
      `!${join(externalApp, '**/*.server.*')}`,
    ])
  })

  it('adds glob for external layer when rootDir has trailing slash', () => {
    const nuxt = {
      options: {
        rootDir: '/project/',
        srcDir: '/project/app',
      },
    } as any
    vi.mocked(getLayerDirectories).mockReturnValue([
      { app: '/outside/app', root: '/outside' } as any,
    ])

    const entries = getOptimizeDepsEntries(nuxt, mainEntry)

    expect(entries).toEqual([
      mainEntry,
      join('/outside/app', '**/*.{vue,ts,tsx,js,jsx,mjs}'),
      `!${join('/outside/app', '**/*.server.*')}`,
    ])
  })
})
