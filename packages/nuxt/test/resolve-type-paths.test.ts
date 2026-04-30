import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('exsolve', () => ({
  resolveModulePath: vi.fn(),
}))

vi.mock('pkg-types', () => ({
  resolvePackageJSON: vi.fn(),
}))

const { resolveModulePath } = await import('exsolve')
const { resolvePackageJSON } = await import('pkg-types')

const mockedResolveModulePath = vi.mocked(resolveModulePath)
const mockedResolvePackageJSON = vi.mocked(resolvePackageJSON)

// Re-import resolveTypePaths for each test to reset the module-level rootCache
function freshImport () {
  vi.resetModules()

  // Re-setup mocks after module reset (they get cleared too)
  vi.doMock('exsolve', () => ({ resolveModulePath: mockedResolveModulePath }))
  vi.doMock('pkg-types', () => ({ resolvePackageJSON: mockedResolvePackageJSON }))

  return import('../src/core/utils/types.ts')
}

describe('resolveTypePaths', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('resolves a base package to its root directory', async () => {
    const { resolveTypePaths } = await freshImport()

    mockedResolveModulePath.mockReturnValue('/node_modules/vue/dist/vue.mjs')
    mockedResolvePackageJSON.mockResolvedValue('/node_modules/vue/package.json')

    const results = await resolveTypePaths(['vue'], ['/project/node_modules'])

    expect(results).toEqual([['vue', '/node_modules/vue']])
  })

  it('resolves a subpath entry via the base package root', async () => {
    const { resolveTypePaths } = await freshImport()

    mockedResolveModulePath.mockImplementation((path) => {
      if (path === 'nitro') { return '/node_modules/nitro/dist/index.mjs' }
      if (path === 'nitro/app') { return '/node_modules/nitro/dist/app.d.mts' }
      throw new Error('MODULE_NOT_FOUND')
    })
    mockedResolvePackageJSON.mockResolvedValue('/node_modules/nitro/package.json')

    const results = await resolveTypePaths(['nitro/app'], ['/project/node_modules'])

    expect(results).toEqual([['nitro/app', '/node_modules/nitro/dist/app']])
  })

  it('caches base package root across multiple subpath entries', async () => {
    const { resolveTypePaths } = await freshImport()

    mockedResolveModulePath.mockImplementation((path) => {
      if (path === 'nitro') { return '/node_modules/nitro/dist/index.mjs' }
      if (path === 'nitro/app') { return '/node_modules/nitro/dist/app.d.mts' }
      if (path === 'nitro/builder') { return '/node_modules/nitro/dist/builder.d.mts' }
      throw new Error('MODULE_NOT_FOUND')
    })
    mockedResolvePackageJSON.mockResolvedValue('/node_modules/nitro/package.json')

    const results = await resolveTypePaths(['nitro/app', 'nitro/builder'], ['/project/node_modules'])

    expect(results).toHaveLength(2)
    expect(results).toContainEqual(['nitro/app', '/node_modules/nitro/dist/app'])
    expect(results).toContainEqual(['nitro/builder', '/node_modules/nitro/dist/builder'])

    // resolvePackageJSON called only once (for the base 'nitro', then cached)
    expect(mockedResolvePackageJSON).toHaveBeenCalledTimes(1)
  })

  it('skips subpath entries when base package cannot be resolved', async () => {
    const { resolveTypePaths } = await freshImport()

    mockedResolveModulePath.mockImplementation(() => {
      throw new Error('MODULE_NOT_FOUND')
    })

    const results = await resolveTypePaths(['missing/app', 'missing/builder'], ['/project/node_modules'])

    expect(results).toEqual([])
  })

  it('handles a mix of base packages and subpath entries', async () => {
    const { resolveTypePaths } = await freshImport()

    mockedResolveModulePath.mockImplementation((path) => {
      const map: Record<string, string> = {
        'vue': '/node_modules/vue/dist/vue.mjs',
        'nitro': '/node_modules/nitro/dist/index.mjs',
        'nitro/app': '/node_modules/nitro/dist/app.d.mts',
        'nitro/types': '/node_modules/nitro/dist/types.d.mts',
      }
      if (typeof path === 'string' && path in map) { return map[path]! }
      throw new Error('MODULE_NOT_FOUND')
    })

    // eslint-disable-next-line require-await
    mockedResolvePackageJSON.mockImplementation(async (r) => {
      if (r?.includes('vue')) { return '/node_modules/vue/package.json' }
      if (r?.includes('nitro')) { return '/node_modules/nitro/package.json' }
      throw new Error('not found')
    })

    const results = await resolveTypePaths(['vue', 'nitro/app', 'nitro/types'], ['/project/node_modules'])

    expect(results).toHaveLength(3)
    expect(results).toContainEqual(['vue', '/node_modules/vue'])
    expect(results).toContainEqual(['nitro/app', '/node_modules/nitro/dist/app'])
    expect(results).toContainEqual(['nitro/types', '/node_modules/nitro/dist/types'])
  })

  it('strips various type extensions from subpath resolutions', async () => {
    const { resolveTypePaths } = await freshImport()

    mockedResolveModulePath.mockImplementation((path) => {
      if (path === 'nitro') { return '/node_modules/nitro/dist/index.mjs' }
      if (path === 'nitro/app') { return '/node_modules/nitro/dist/app.d.mts' }
      throw new Error('MODULE_NOT_FOUND')
    })
    mockedResolvePackageJSON.mockResolvedValue('/node_modules/nitro/package.json')

    const results = await resolveTypePaths(['nitro/app'], ['/project/node_modules'])

    // .d.mts should be stripped
    expect(results[0]![1]).toBe('/node_modules/nitro/dist/app')
  })

  it('handles resolution errors gracefully for individual packages', async () => {
    const { resolveTypePaths } = await freshImport()

    mockedResolveModulePath.mockImplementation((path) => {
      if (path === 'vue') { return '/node_modules/vue/dist/vue.mjs' }
      throw new Error('MODULE_NOT_FOUND')
    })
    mockedResolvePackageJSON.mockResolvedValue('/node_modules/vue/package.json')

    const results = await resolveTypePaths(['vue', 'nonexistent'], ['/project/node_modules'])

    // vue resolves, nonexistent is silently skipped
    expect(results).toEqual([['vue', '/node_modules/vue']])
  })
})
