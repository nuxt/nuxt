import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import type { Nuxt } from '@nuxt/schema'

import { prerenderRoutes } from '../src/prerender.ts'

function createProject () {
  const dir = mkdtempSync(join(tmpdir(), 'vite-server-prerender-'))
  onTestFinished(() => rmSync(dir, { recursive: true, force: true }))
  const handler = join(dir, 'handler.mjs')
  writeFileSync(handler, `export const fetch = request => new URL(request.url).pathname === '/broken'
  ? new Response('', { status: 500, statusText: 'boom' })
  : new Response('<html></html>', { headers: { 'content-type': 'text/html' } })
`)
  return { handler, publicDir: join(dir, 'public') }
}

function createNuxt (prerender: Record<string, unknown> = {}) {
  return {
    apps: {},
    callHook: () => Promise.resolve(),
    options: {
      app: { baseURL: '/' },
      experimental: { prerenderErrorPages: false },
      nitro: { prerender },
      prerender: { routes: ['/broken'], crawlLinks: false },
      router: { options: {} },
      routeRules: {},
    },
  } as unknown as Nuxt
}

describe('prerenderRoutes', () => {
  it('throws a diagnostic naming the routes that failed to prerender', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(prerenderRoutes(createNuxt(), createProject())).rejects.toMatchObject({
      code: 'NUXT_B1024',
      message: '1 route failed to prerender: `/broken` (500).',
    })
  })

  it('finishes when failOnError is disabled', async () => {
    await expect(prerenderRoutes(createNuxt({ failOnError: false }), createProject())).resolves.toEqual(['/200.html', '/404.html'])
  })
})
