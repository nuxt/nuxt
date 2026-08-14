import { pathToFileURL } from 'node:url'
import { resolve } from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import '../src/impl.ts'
import { resolveModulePath } from 'exsolve'
import { server } from '../src/configs/server.ts'
import type { WebpackConfigContext } from '../src/utils/config.ts'

vi.mock('exsolve', async (importOriginal) => {
  const actual = await importOriginal<typeof import('exsolve')>()
  return {
    ...actual,
    resolveModulePath: vi.fn(),
  }
})

vi.mock('../src/presets/nuxt.ts', () => ({ nuxt: vi.fn() }))
vi.mock('../src/presets/node.ts', () => ({ node: vi.fn() }))

async function resolveRuntimeDependency (dev: boolean, resolvedPath: string) {
  vi.mocked(resolveModulePath).mockReturnValue(resolvedPath)

  const rootDir = resolve('/project')
  const options = {
    build: { transpile: [] },
    dev,
    dir: { shared: 'shared' },
    modulesDir: [resolve(rootDir, 'node_modules')],
    rootDir,
    sourcemap: { server: false },
    test: true,
  }
  const ctx = {
    config: {
      externals: [],
      output: {},
    },
    isDev: dev,
    nuxt: {
      options,
      '~runtimeDependencies': ['runtime-dependency'],
    },
    options,
    userConfig: {},
  } as unknown as WebpackConfigContext

  await server(ctx)

  const externals = ctx.config.externals
  if (!Array.isArray(externals)) {
    throw new TypeError('expected server externals to be an array')
  }
  const resolver = externals.at(-1)
  if (typeof resolver !== 'function') {
    throw new TypeError('expected server external resolver to be a function')
  }

  return new Promise<unknown>((resolveResult, reject) => {
    resolver(
      {
        context: resolve(rootDir, 'server'),
        request: 'runtime-dependency',
      } as any,
      (error, result) => {
        if (error) {
          reject(error)
        } else {
          resolveResult(result)
        }
      },
    )
  })
}

describe('server externals', () => {
  const posixResolvedPath = '/project/node_modules/runtime-dependency/index.mjs'
  const windowsResolvedPath = 'D:/project/node_modules/runtime-dependency/index.mjs'

  it('uses file URLs for Windows resolved externals in development', async () => {
    await expect(resolveRuntimeDependency(true, windowsResolvedPath)).resolves.toBe(
      pathToFileURL(windowsResolvedPath, { windows: true }).href,
    )
  })

  it('keeps POSIX resolved external paths unchanged in development', async () => {
    await expect(resolveRuntimeDependency(true, posixResolvedPath)).resolves.toBe(posixResolvedPath)
  })

  it('keeps resolved external paths unchanged for production builds', async () => {
    await expect(resolveRuntimeDependency(false, windowsResolvedPath)).resolves.toBe(windowsResolvedPath)
    await expect(resolveRuntimeDependency(false, posixResolvedPath)).resolves.toBe(posixResolvedPath)
  })
})
