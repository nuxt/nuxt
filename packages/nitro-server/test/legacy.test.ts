import { describe, expect, it, vi } from 'vitest'
import { createHooks } from 'hookable'
import type { Nuxt } from '@nuxt/schema'
import type { Nitro } from 'nitro/types'
import { setupLegacyDevAndBuild } from '../src/legacy.ts'

const reload = vi.fn()

vi.mock('nitro/builder', () => ({
  build: vi.fn(),
  copyPublicAssets: vi.fn(),
  createDevServer: () => ({ reload }),
  prepare: vi.fn(),
  prerender: vi.fn(),
}))

function setup () {
  reload.mockClear()
  const nuxtHooks = createHooks<any>()
  const nitroHooks = createHooks<any>()
  const nuxt = {
    options: { dev: true, buildDir: '/build', devServer: {} },
    hook: nuxtHooks.hook,
    callHook: nuxtHooks.callHook,
  } as unknown as Nuxt
  const nitro = {
    options: { devHandlers: [], virtual: {} },
    hooks: nitroHooks,
  } as unknown as Nitro
  setupLegacyDevAndBuild(nuxt, nitro)
  return { nuxt, nitro }
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
})
