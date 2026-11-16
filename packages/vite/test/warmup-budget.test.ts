import { fileURLToPath } from 'node:url'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { join } from 'pathe'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildNuxt, loadNuxt, logger } from '@nuxt/kit'

const fixtureDir = fileURLToPath(new URL('../../../test/fixtures-temp/warmup-budget', import.meta.url))

describe('vite warmup budget', () => {
  beforeAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true })
    await mkdir(join(fixtureDir, 'app'), { recursive: true })
    await writeFile(join(fixtureDir, 'app/app.vue'), '<script setup>import { message } from "./heavy"</script><template><div>{{ message }}</div></template>')
    await writeFile(join(fixtureDir, 'app/heavy.ts'), 'export const message = "hello"')
  })

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true })
  })

  it('should warm the client after the server exhausts its time budget', async () => {
    let offset = 0
    let slowServerTransform = false
    const clientTransforms: string[] = []
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
      dev: true,
      overrides: {
        test: false,
        devtools: { enabled: false },
        experimental: { nitroViteEnvironment: false },
        vite: {
          plugins: [{
            name: 'test:slow-server-transform',
            transform (_code, id) {
              if (!id.endsWith('/app/heavy.ts')) { return }
              if (this.environment.name === 'ssr' && !slowServerTransform) {
                slowServerTransform = true
                offset += 21_000
              }
              if (this.environment.name === 'client') {
                clientTransforms.push(id)
              }
            },
          }],
        },
      },
    })
    const now = performance.now.bind(performance)
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now() + offset)
    const debug = vi.spyOn(logger, 'debug')

    try {
      await buildNuxt(nuxt)
      await expect.poll(() => debug.mock.calls.some(([message]) => typeof message === 'string' && message.startsWith('Vite client warmed up'))).toBe(true)
      expect(slowServerTransform).toBe(true)
      expect(clientTransforms).toContain(join(fixtureDir, 'app/heavy.ts'))
    } finally {
      await nuxt.close()
      clock.mockRestore()
      debug.mockRestore()
    }
  }, 60000)
})
