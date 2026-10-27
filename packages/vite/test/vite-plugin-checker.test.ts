import { createServer } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { describe, expect, it, vi } from 'vitest'
import { VitePluginCheckerPlugin } from '../src/plugins/vite-plugin-checker.ts'

const { workers } = vi.hoisted(() => ({ workers: [] as Array<{ terminate: ReturnType<typeof vi.fn> }> }))

vi.mock('pkg-types', () => ({
  resolveTSConfig: async () => '/tmp/tsconfig.json',
  readTSConfig: async () => ({}),
}))

vi.mock('vite-plugin-checker', () => ({
  default: () => {
    let worker: typeof workers[number]
    return {
      name: 'vite-plugin-checker',
      config () {
        worker = { terminate: vi.fn() }
        workers.push(worker)
      },
      buildEnd () {
        worker.terminate()
      },
    }
  },
}))

describe('checker worker cleanup', () => {
  it.each([true, false])('terminates every checker across soft reloads (ssr: %s)', async (ssr) => {
    workers.length = 0
    const nuxt = { options: { test: false, dev: true, ssr, rootDir: '/tmp', typescript: { typeCheck: true } } } as Nuxt

    // Recreating the server models Nuxt's soft reload (close, then create).
    for (let reload = 0; reload < 2; reload++) {
      const plugins = await VitePluginCheckerPlugin(nuxt)
      expect(plugins?.every(plugin => plugin && 'perEnvironmentStartEndDuringDev' in plugin && plugin.perEnvironmentStartEndDuringDev === true)).toBe(true)

      const server = await createServer({
        configFile: false,
        plugins,
        server: { middlewareMode: true, watch: null, ws: false },
        environments: { client: {}, ssr: {} },
        optimizeDeps: { noDiscovery: true, include: [] },
      })
      try {
        // Keep global Vite default unchanged — only the checker plugins opt in.
        expect(server.config.server.perEnvironmentStartEndDuringDev).toBe(false)
      } finally {
        await server.close()
      }
      expect(workers).toHaveLength((reload + 1) * (ssr ? 2 : 1))
      for (const worker of workers) {
        expect(worker.terminate).toHaveBeenCalledTimes(1)
      }
    }
  })
})
