import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import type { UserConfig as ViteConfig, Plugin as VitePlugin } from 'vite'

vi.mock('../src/context.ts', () => ({
  useNuxt: () => mockNuxt,
}))

let mockNuxt: Partial<Nuxt>
let viteExtendCallback: ((ctx: { config: ViteConfig }) => Promise<void>) | null = null

const { addVitePlugin } = await import('../src/build.ts')

describe('addVitePlugin', () => {
  beforeEach(() => {
    viteExtendCallback = null
    mockNuxt = {
      options: { dev: false, build: true },
      hook: vi.fn((name: string, cb: any) => {
        if (name === 'vite:extend') {
          viteExtendCallback = cb
        }
      }),
    } as unknown as Partial<Nuxt>
  })

  it('should add plugin to worker.plugins when worker: true', async () => {
    const existingPlugin: VitePlugin = { name: 'existing' }
    const newPlugin: VitePlugin = { name: 'new' }
    const config: ViteConfig = {
      worker: { plugins: () => [existingPlugin] },
    }

    addVitePlugin(newPlugin, { worker: true })
    await viteExtendCallback?.({ config })

    const workerPlugins = config.worker?.plugins?.()
    expect(workerPlugins).toContain(existingPlugin)
    expect(workerPlugins).toContain(newPlugin)
  })
})
