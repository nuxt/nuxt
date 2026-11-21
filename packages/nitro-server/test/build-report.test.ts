import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { join, resolve } from 'pathe'
import { loadNuxt } from '@nuxt/kit'
import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import { build } from 'nitropack'
import type { Nitro } from 'nitropack/types'

vi.mock('nitropack', async importOriginal => ({
  ...await importOriginal<typeof import('nitropack')>(),
  build: vi.fn(),
  prepare: vi.fn(),
  prerender: vi.fn(),
}))
vi.mock('../src/utils.ts', async importOriginal => ({
  ...await importOriginal<typeof import('../src/utils.ts')>(),
  linkStaticDist: vi.fn(),
}))

const fixtureDir = resolve(import.meta.dirname, '../../../test/fixtures/minimal')

let outputDir: string | undefined

afterEach(async () => {
  vi.mocked(build).mockReset()
  if (outputDir) {
    await rm(outputDir, { recursive: true, force: true })
    outputDir = undefined
  }
})

async function withNitro<T> (overrides: NuxtConfig, fn: (nitro: Nitro, nuxt: Nuxt, calls: unknown[][]) => T | Promise<T>) {
  outputDir = await mkdtemp(join(tmpdir(), 'nuxt-nitropack-report-'))
  let nitro: Nitro | undefined
  const nuxt = await loadNuxt({
    cwd: fixtureDir,
    ready: true,
    overrides: {
      ...overrides,
      nitro: { ...overrides.nitro, output: { dir: outputDir } },
      hooks: {
        'nitro:init' (_nitro) {
          nitro = _nitro
        },
      },
    },
  })
  const calls: unknown[][] = []
  nuxt.hooks.beforeEach(({ name, args }) => {
    if (name.startsWith('build:environment:') || name.startsWith('build:prerender:')) {
      calls.push([name, ...args])
    }
  })
  try {
    return await fn(nitro!, nuxt, calls)
  } finally {
    await nuxt.close()
  }
}

describe('nitropack build report', () => {
  it.each([false, true])('reports the nitro bundle of a production build unless it is static (%s)', async (isStatic) => {
    await withNitro({ dev: false, nitro: { static: isStatic } }, async (nitro, nuxt, calls) => {
      const serverDir = nitro.options.output.serverDir
      vi.mocked(build).mockImplementationOnce(async () => {
        await mkdir(serverDir, { recursive: true })
        await writeFile(join(serverDir, 'index.mjs'), 'export {}')
      })

      await nuxt.callHook('build:done')

      const environment = { name: 'nitro', consumer: 'server', builder: 'rollup' }
      expect(calls).toEqual(isStatic
        ? []
        : [
            ['build:environment:start', environment],
            ['build:environment:done', environment, { duration: expect.any(Number), outDir: serverDir, files: [{ path: 'index.mjs', size: 9 }] }],
          ])
    })
  }, 60_000)

  it('reports nitropack prerendering through the `build:prerender:*` hooks', async () => {
    await withNitro({ dev: false }, async (nitro, _nuxt, calls) => {
      await nitro.hooks.callHook('prerender:routes', new Set(['/', '/about']))
      await nitro.hooks.callHook('prerender:init', nitro)
      await nitro.hooks.callHook('prerender:route', { route: '/', fileName: '/index.html', generateTimeMS: 5 })
      const error = Object.assign(new Error('[500] Server Error'), { statusCode: 500, statusMessage: 'Server Error' })
      await nitro.hooks.callHook('prerender:route', { route: '/about', generateTimeMS: 2, error })
      await expect(nitro.hooks.callHook('prerender:done', { prerenderedRoutes: [{ route: '/' }], failedRoutes: [{ route: '/about', error }] })).rejects.toMatchObject({ code: 'NUXT_B1024' })

      expect(calls).toEqual([
        ['build:prerender:start', { routes: 2 }],
        ['build:prerender:route', { route: '/', duration: 5, total: 2, skipped: false, fileName: 'index.html' }],
        ['build:prerender:route', { route: '/about', duration: 2, total: 2, skipped: false, error: { status: 500, message: 'Server Error' } }],
        ['build:prerender:done', { duration: expect.any(Number), written: 1, failed: [{ route: '/about', status: 500, message: 'Server Error' }] }],
      ])
    })
  }, 60_000)
})
