import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import { createServer } from 'vite'
import type { ViteDevServer } from 'vite'

import { errorChannelAccess, reportFileAccess } from '../src/dev-errors.ts'

const nuxt = (allowedHosts: string[] | true = ['configured.test']) => ({ options: { devServer: { allowedHosts }, vite: {} } }) as unknown as Nuxt
const server = (allowedHosts: string[] | true, fs: { allow: string[], strict?: boolean } = { allow: ['/repo'] }) => ({ config: { server: { allowedHosts, fs } } }) as unknown as ViteDevServer

describe('errorChannelAccess', () => {
  it('allows the hosts the dev server resolved, including those its plugins added', () => {
    expect(errorChannelAccess(nuxt(), server(['configured.test', 'plugin.test']))).toEqual({ root: ['/repo'], allowedHosts: ['configured.test', 'plugin.test'] })
    expect(errorChannelAccess(nuxt(), server(true)).allowedHosts).toBe(true)
  })

  it('opens any file when the dev server serves any', () => {
    expect(errorChannelAccess(nuxt(), server([], { allow: ['/repo'], strict: false })).root).toBe(false)
  })
})

describe('reportFileAccess', () => {
  it('allows files outside `server.fs.allow` only when the client environment may load them', async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'nuxt-report-access-')))
    const app = join(root, 'app')
    mkdirSync(app)
    const clientSafe = join(root, 'client-safe.js')
    const ssrSafe = join(root, 'ssr-safe.js')
    const viteServer = await createServer({
      configFile: false,
      logLevel: 'silent',
      root: app,
      server: { middlewareMode: true, ws: false, watch: null, fs: { allow: [app] } },
    })
    viteServer.environments.client!.addSafeModule(clientSafe)
    viteServer.environments.ssr!.addSafeModule(ssrSafe)

    try {
      const canRead = reportFileAccess(viteServer)
      expect(canRead(join(app, 'app.vue'))).toBe(true)
      expect(canRead(clientSafe)).toBe(true)
      expect(canRead(ssrSafe)).toBe(false)
    } finally {
      await viteServer.close()
      rmSync(root, { recursive: true, force: true })
    }
  })
})
