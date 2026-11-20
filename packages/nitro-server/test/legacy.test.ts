import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { createHooks } from 'hookable'
import type { Nuxt } from '@nuxt/schema'
import type { Nitro } from 'nitro/types'
import { build } from 'nitro/builder'
import { setupLegacyDevAndBuild } from '../src/legacy.ts'

const reload = vi.fn()

vi.mock('nitro/builder', () => ({
  build: vi.fn(),
  copyPublicAssets: vi.fn(),
  createDevServer: () => ({ reload }),
  prepare: vi.fn(),
  prerender: vi.fn(),
}))

function setup (options: { dev?: boolean, nitro?: Record<string, unknown> } = {}) {
  reload.mockClear()
  const nuxtHooks = createHooks<any>()
  const nitroHooks = createHooks<any>()
  const nuxt = {
    options: { dev: options.dev ?? true, buildDir: '/build', rootDir: '/root', devServer: {} },
    hook: nuxtHooks.hook,
    hooks: nuxtHooks,
    callHook: nuxtHooks.callHook,
  } as unknown as Nuxt
  const nitro = {
    options: { devHandlers: [], virtual: {}, ...options.nitro },
    hooks: nitroHooks,
  } as unknown as Nitro
  setupLegacyDevAndBuild(nuxt, nitro)
  return { nuxt, nitro, nuxtHooks }
}

describe('setupLegacyDevAndBuild', () => {
  it('reloads the dev server on `vite:compiled` only once nitro has built', async () => {
    const { nuxt, nitro } = setup()

    await nuxt.callHook('vite:compiled')
    expect(reload).not.toHaveBeenCalled()

    await nitro.hooks.callHook('compiled', nitro)
    await nuxt.callHook('vite:compiled')
    expect(reload).toHaveBeenCalledOnce()
  })

  it.each([false, true])('reports the nitro bundle of a production build unless it is static (%s)', async (isStatic) => {
    const serverDir = await mkdtemp(join(tmpdir(), 'nuxt-nitro-legacy-'))
    try {
      vi.mocked(build).mockImplementationOnce(() => writeFile(join(serverDir, 'index.mjs'), 'export {}'))
      const { nuxt, nuxtHooks } = setup({ dev: false, nitro: { static: isStatic, builder: 'rolldown', output: { serverDir, publicDir: serverDir } } })
      const calls: unknown[][] = []
      nuxtHooks.beforeEach(({ name, args }) => {
        if (name.startsWith('build:environment:')) { calls.push([name, ...args]) }
      })

      await nuxt.callHook('build:done')

      const environment = { name: 'nitro', consumer: 'server', builder: 'rolldown' }
      expect(calls).toEqual(isStatic
        ? []
        : [
            ['build:environment:start', environment],
            ['build:environment:done', environment, { duration: expect.any(Number), outDir: serverDir, files: [{ path: 'index.mjs', size: 9 }] }],
          ])
    } finally {
      await rm(serverDir, { recursive: true, force: true })
    }
  })
})
