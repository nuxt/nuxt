import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResolveDeepImportsPlugin } from '../src/plugins/resolve-deep-imports.ts'

vi.mock('@nuxt/kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nuxt/kit')>()
  return {
    ...actual,
    logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  }
})

const { logger } = await import('@nuxt/kit')

function createNuxt () {
  return {
    options: {
      dev: true,
      alias: {},
      appDir: '/project/app',
      buildDir: '/project/.nuxt',
      modulesDir: [],
      build: { templates: [] },
      experimental: {},
    },
  } as any
}

function createContext (resolved: { id: string } | null = null) {
  return {
    resolve: vi.fn().mockResolvedValue(resolved),
    environment: { name: 'client', config: { mode: 'development', resolve: { conditions: [] } } },
  }
}

function resolveId (context: ReturnType<typeof createContext>, id: string, importer?: string, options: { isEntry?: boolean } = {}) {
  const plugin = ResolveDeepImportsPlugin(createNuxt()) as any
  return plugin.resolveId.handler.call(context, id, importer, options)
}

function excluded (id: string) {
  const plugin = ResolveDeepImportsPlugin(createNuxt()) as any
  return plugin.resolveId.filter.id.exclude.some((re: RegExp) => re.test(id))
}

describe('ResolveDeepImportsPlugin', () => {
  beforeEach(() => {
    vi.mocked(logger.debug).mockClear()
  })

  it.each([
    ['/project/app/app.vue', true],
    ['C:\\project\\app\\app.vue', true],
    ['virtual:nuxt:/project/.nuxt/routes.mjs', true],
    ['\0virtual:nuxt:/project/.nuxt/routes.mjs', true],
    ['/__skip_vite/foo', true],
    ['@vitest/coverage-v8', true],
    ['some-pkg/deep/import', false],
    ['./relative.mjs', false],
  ])('filters %s', (id, isExcluded) => {
    expect(excluded(id)).toBe(isExcluded)
  })

  it.each(['index.html', 'index.html?html-proxy'])('skips %s entry probes', async (id) => {
    const context = createContext()

    await expect(resolveId(context, id, '/project/app/index.html', { isEntry: true })).resolves.toBeUndefined()
    expect(context.resolve).not.toHaveBeenCalled()
    expect(logger.debug).not.toHaveBeenCalled()
  })

  it('resolves bare entry specifiers', async () => {
    const context = createContext({ id: '/project/node_modules/some-pkg/entry.mjs' })

    await expect(resolveId(context, 'some-pkg/entry', '/project/app/entry.mjs', { isEntry: true })).resolves.toStrictEqual({ id: '/project/node_modules/some-pkg/entry.mjs' })
    expect(context.resolve).toHaveBeenCalledWith('some-pkg/entry', '/project/app', { skipSelf: true })
  })

  it.each([
    ['no importer', undefined],
    ['a bare importer', 'some-other-pkg'],
    ['a relative importer', './importer.mjs'],
  ])('ignores ids with %s', async (_, importer) => {
    const context = createContext()

    await expect(resolveId(context, 'some-pkg', importer)).resolves.toBeUndefined()
    expect(context.resolve).not.toHaveBeenCalled()
  })

  it('logs unresolved bare imports', async () => {
    const context = createContext()

    await expect(resolveId(context, 'does-not-exist', '/project/app/entry.mjs')).resolves.toBeNull()
    expect(logger.debug).toHaveBeenCalledWith('Could not resolve id', 'does-not-exist', '/project/app/entry.mjs')
  })
})
