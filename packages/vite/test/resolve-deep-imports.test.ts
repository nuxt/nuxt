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

function createContext () {
  return {
    resolve: vi.fn().mockResolvedValue(null),
    environment: { name: 'client', config: { mode: 'development', resolve: { conditions: [] } } },
  }
}

describe('ResolveDeepImportsPlugin', () => {
  beforeEach(() => {
    vi.mocked(logger.debug).mockClear()
  })

  it('skips fallback entry probes such as index.html', async () => {
    const plugin = ResolveDeepImportsPlugin(createNuxt()) as any
    const context = createContext()

    const result = await plugin.resolveId.handler.call(context, 'index.html', '/project/app/index.html', { isEntry: true })

    expect(result).toBeUndefined()
    expect(context.resolve).not.toHaveBeenCalled()
    expect(logger.debug).not.toHaveBeenCalled()
  })
})
