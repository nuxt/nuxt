import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { readPackageJSON } from 'pkg-types'
import { inc } from 'semver'
import { loadNuxt } from '../src'
import { version } from '../package.json'

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
  it('expect mismatched dependency to log a warning', async () => {
    vi.mocked(readPackageJSON).mockReturnValue(Promise.resolve({
      version: '3.0.0',
    }))

    const nuxt = await loadNuxt({
      cwd: repoRoot,
    })

    // @nuxt/kit is explicitly installed in repo root but @nuxt/schema isn't, so we only
    // get warnings about @nuxt/schema
    expect(console.warn).toHaveBeenCalledWith(`[nuxt] Expected \`@nuxt/kit\` to be at least \`${version}\` but got \`3.0.0\`. This might lead to unexpected behavior. Check your package.json or refresh your lockfile.`)

    vi.mocked(readPackageJSON).mockRestore()
    await nuxt.close()
  })
  it.each([
    {
      name: 'nuxt version is lower',
      depVersion: inc(version, 'minor'),
    },
    {
      name: 'version matches',
      depVersion: version,
    },
  ])('expect no warning when $name.', async ({ depVersion }) => {
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
