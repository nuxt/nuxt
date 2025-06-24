import { afterEach, describe, expect, it, vi } from 'vitest'
import { readPackageJSON } from 'pkg-types'
import { inc } from 'semver'
import { version } from '../package.json'
import { checkDependencyVersion, keyDependencies } from '../src/core/nuxt'

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

describe('dependency mismatch', () => {
  it.sequential('expect mismatched dependency to log a warning', async () => {
    vi.mocked(readPackageJSON).mockReturnValue(Promise.resolve({
      version: '3.0.0',
    }))

    for (const dep of keyDependencies) {
      await checkDependencyVersion(dep, version)
    }

    // @nuxt/kit is explicitly installed in repo root but @nuxt/schema isn't, so we only
    // get warnings about @nuxt/schema
    expect(console.warn).toHaveBeenCalledWith(`[nuxt] Expected \`@nuxt/kit\` to be at least \`${version}\` but got \`3.0.0\`. This might lead to unexpected behavior. Check your package.json or refresh your lockfile.`)

    vi.mocked(readPackageJSON).mockRestore()
  })
  it.sequential.each([
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

    for (const dep of keyDependencies) {
      await checkDependencyVersion(dep, version)
    }

    expect(console.warn).not.toHaveBeenCalled()
    vi.mocked(readPackageJSON).mockRestore()
  })
})
