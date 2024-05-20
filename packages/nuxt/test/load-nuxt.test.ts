import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { readPackageJSON } from 'pkg-types'
import { loadNuxt } from '../src'
import { version } from '../package.json'
import { inc } from "semver"

const repoRoot = withoutTrailingSlash(normalize(fileURLToPath(new URL('../../../', import.meta.url))))

vi.stubGlobal('console', {
  ...console,
  error: vi.fn(console.error),
  warn: vi.fn(console.warn),
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
          ready() {
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
  it('expect mismatched dependency to log a warning', async () => {
    vi.mocked(readPackageJSON).mockReturnValue(Promise.resolve({
      version: '3.0.0',
    }))

    const nuxt = await loadNuxt({
      cwd: repoRoot,
    })

    expect(console.warn).toHaveBeenCalledWith(`Version mismatch for @nuxt/kit and nuxt: expected ${version} (nuxt) but got 3.0.0. This might lead to unexpected behavior. Check your package.json or refresh your lockfile.`)
    expect(console.warn).toHaveBeenCalledWith(`Version mismatch for @nuxt/schema and nuxt: expected ${version} (nuxt) but got 3.0.0. This might lead to unexpected behavior. Check your package.json or refresh your lockfile.`)

    vi.mocked(readPackageJSON).mockRestore()
    await nuxt.close()
  })
  it.each([
    {
      name: 'nuxt version is lower',
      nuxtVersion: version,
      depVersion: inc(version, "minor"),
    },
    {
      name: 'version matches',
      nuxtVersion: version,
      depVersion: version,
    }
  ])('expect no warning when $name.', async ({ nuxtVersion, depVersion }) => {
    vi.mocked(readPackageJSON).mockReturnValue(Promise.resolve({
      depVersion,
    }))

    const nuxt = await loadNuxt({
      cwd: repoRoot,
    })

    expect(console.warn).not.toHaveBeenCalled()

    await nuxt.close()
    vi.mocked(readPackageJSON).mockRestore()
  })
})
