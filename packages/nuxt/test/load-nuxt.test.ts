import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { asyncNameStorage, logger, useNuxt } from '@nuxt/kit'
import { loadNuxt } from '../src'

const repoRoot = withoutTrailingSlash(normalize(fileURLToPath(new URL('../../../', import.meta.url))))

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
    await nuxt.hook('test', () => {
      const nuxt = useNuxt()
      expect(asyncNameStorage.getStore()).toBe(nuxt.__name)
    })

    expect(asyncNameStorage.getStore()).toBeUndefined()

    // @ts-expect-error - random hook
    await nuxt.callHook('test')

    expect(loggerWarn).not.toHaveBeenCalled()
  })
})
