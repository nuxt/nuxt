import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { version } from "../package.json"
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { loadNuxt } from '../src'
import { readPackageJSON } from 'pkg-types'

const repoRoot = withoutTrailingSlash(normalize(fileURLToPath(new URL('../../../', import.meta.url))))

vi.stubGlobal('console', {
  ...console,
  error: vi.fn(console.error),
})

vi.mock('pkg-types', async (og) => {
  const originalPkgTypes = (await og<typeof import('pkg-types')>())
  return {
    ...originalPkgTypes,
    readPackageJSON: vi.fn(originalPkgTypes.readPackageJSON),
  }
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
})

describe('dependency mismatch', () => {
  it('expect mismatched dependency to log a warning',async  () => {
    vi.mocked(readPackageJSON).mockReturnValue(Promise.resolve({
      version: '3.0.0'
    }))

    const nuxt = await loadNuxt({
      cwd: repoRoot,
    })

    expect(console.error).toHaveBeenCalledWith(`Version mismatch for @nuxt/kit and nuxt: expected ${version} (nuxt) but got 3.0.0`)
    expect(console.error).toHaveBeenCalledWith(`Version mismatch for @nuxt/schema and nuxt: expected ${version} (nuxt) but got 3.0.0`)
    
    vi.mocked(readPackageJSON).mockRestore()
    await nuxt.close()
  })
  it('expect no warning when dependency version matches',async  () => {
    vi.mocked(readPackageJSON).mockReturnValue(Promise.resolve({
      version
    }))

    const nuxt = await loadNuxt({
      cwd: repoRoot,
    })

    expect(console.error).not.toHaveBeenCalled()

    await nuxt.close()
    vi.mocked(readPackageJSON).mockRestore()
  })
})