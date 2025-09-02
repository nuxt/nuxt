import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { logger, tryUseNuxt, useNuxt } from '@nuxt/kit'
import { findWorkspaceDir } from 'pkg-types'
import { loadNuxt } from '../src'
import type { NuxtConfig } from '../schema'

const repoRoot = await findWorkspaceDir()

vi.stubGlobal('console', {
  ...console,
  error: vi.fn(console.error),
  warn: vi.fn(console.warn),
})

const loggerWarn = vi.spyOn(logger, 'warn')
vi.mock('pkg-types', async (og) => {
  const originalPkgTypes = (await og<typeof import('pkg-types')>())
  return {
    ...originalPkgTypes,
    readPackageJSON: vi.fn(originalPkgTypes.readPackageJSON),
  }
})

beforeEach(() => {
  loggerWarn.mockClear()
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('loadNuxt', () => {
  it('respects hook overrides', async () => {
    let hookRan = false
    const nuxt = await loadNuxt({
      cwd: repoRoot,
      ready: true,
      overrides: {
        hooks: {
          ready () {
            hookRan = true
          },
        },
      },
    })
    await nuxt.close()
    expect(hookRan).toBe(true)
  })

  it('ensures layer CSS remains in order', async () => {
    const layerFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./layers-fixture', import.meta.url))))
    const nuxt = await loadNuxt({
      cwd: layerFixtureDir,
      overrides: {
        css: ['override.css'],
      },
    })
    await nuxt.close()

    expect(nuxt.options.css).toMatchInlineSnapshot(`
      [
        "custom.css",
        "auto.css",
        "final-project.css",
        "duplicate.css",
        "override.css",
        "new-css-added-by-module.css",
      ]
    `)
  })

  it('load multiple nuxt', async () => {
    await Promise.all([
      loadNuxt({
        cwd: repoRoot,
      }),
      loadNuxt({
        cwd: repoRoot,
      }),
    ])
    expect(loggerWarn).not.toHaveBeenCalled()
  })

  it('expect hooks to get the correct context outside of initNuxt', async () => {
    const nuxt = await loadNuxt({
      cwd: repoRoot,
    })

    // @ts-expect-error - random hook
    nuxt.hook('test', () => {
      expect(useNuxt().__name).toBe(nuxt.__name)
    })

    expect(tryUseNuxt()?.__name).not.toBe(nuxt.__name)

    // second nuxt context
    const second = await loadNuxt({
      cwd: repoRoot,
    })

    expect(second.__name).not.toBe(nuxt.__name)
    expect(tryUseNuxt()?.__name).not.toBe(nuxt.__name)

    // @ts-expect-error - random hook
    await nuxt.callHook('test')

    expect(loggerWarn).not.toHaveBeenCalled()
  })
})

const pagesDetectionTests: [test: string, overrides: NuxtConfig, result: NuxtConfig['pages']][] = [
  ['pages dir', {}, { enabled: true }],
  ['pages dir empty', { dir: { pages: 'empty-dir' } }, { enabled: false }],
  ['user config', { pages: false }, { enabled: false }],
  ['user config', { pages: { enabled: false } }, { enabled: false }],
  ['user config', { pages: { enabled: true, pattern: '**/*{.vue}' } }, { enabled: true, pattern: '**/*{.vue}' }],
]

const pagesFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('./pages-fixture', import.meta.url))))
describe('pages detection', () => {
  it.each(pagesDetectionTests)('%s `%s`', async (_, overrides, result) => {
    const nuxt = await loadNuxt({ cwd: pagesFixtureDir, overrides, ready: true })
    // @ts-expect-error should resolve to object?
    expect(nuxt.options.pages).toMatchObject(result)
    await nuxt.close()
  })
})
