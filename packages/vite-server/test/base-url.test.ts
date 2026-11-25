import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { RendererEvent } from 'nuxt/internal/renderer/runtime'

import { createNodeServer } from '../src/runtime/node.ts'
import { createFetchHandler, createRendererOptions } from '../src/runtime/renderer.ts'
import type { MatchRouteRules, NuxtRenderer } from '../src/runtime/renderer.ts'

vi.mock('#internal/nuxt/paths', () => ({ buildAssetsURL: () => '', publicAssetsURL: () => '' }))

const renderedURL: NuxtRenderer = { fetch: event => Promise.resolve(new Response(event.url.href)) }

describe('vite server under a base URL', () => {
  it('renders a request under the base URL at its path relative to the base', async () => {
    const fetch = createFetchHandler(renderedURL, () => ({}), '/app/')

    expect(await (await fetch(new Request('http://localhost/app/users/42?a=1#top'))).text()).toBe('http://localhost/users/42?a=1#top')
    expect(await (await fetch(new Request('http://localhost/app/'))).text()).toBe('http://localhost/')
    expect(await (await fetch(new Request('http://localhost/app'))).text()).toBe('http://localhost/')
  })

  it('redirects a request outside the base URL under it', async () => {
    const fetch = createFetchHandler(renderedURL, () => ({}), '/app/')

    for (const [path, location] of [['/account?a=1', '/app/account?a=1'], ['/apple', '/app/apple'], ['/', '/app/'], ['//example.com', '/app//example.com']]) {
      const response = await fetch(new Request(`http://localhost${path}`))
      expect(response.status, path).toBe(302)
      expect(response.headers.get('location'), path).toBe(location)
    }
  })

  it('leaves the request path alone under a relative base URL', async () => {
    const fetch = createFetchHandler(renderedURL, () => ({}), './')

    expect(await (await fetch(new Request('http://localhost/account'))).text()).toBe('http://localhost/account')
  })

  it('matches route rules for the request path, base URL included', async () => {
    const match = vi.fn<MatchRouteRules>(path => path === '/app/account' ? { headers: { 'x-account': '1' } } : {})
    const { getRouteRules } = createRendererOptions(() => ({}) as any, match, '/app/')
    const renderer: NuxtRenderer = { fetch: event => Promise.resolve(Response.json(getRouteRules(event as RendererEvent))) }

    const response = await createFetchHandler(renderer, match, '/app/')(new Request('http://localhost/app/account'))

    expect(response.headers.get('x-account')).toBe('1')
    expect(await response.json()).toEqual({ ssr: true, headers: { 'x-account': '1' } })
  })

  describe('node server', () => {
    let publicDir: string

    beforeAll(async () => {
      publicDir = await mkdtemp(join(tmpdir(), 'nuxt-vite-server-base-'))
      await mkdir(join(publicDir, '_nuxt'))
      await writeFile(join(publicDir, '_nuxt/entry.js'), 'export {}')
    })

    afterAll(async () => {
      await rm(publicDir, { recursive: true, force: true })
    })

    it('serves the public directory under the base URL', async () => {
      const render = vi.fn((_request: Request) => Promise.resolve(new Response('rendered')))
      const server = createNodeServer({ fetch: render, publicDir, baseURL: '/app/' })

      const asset = await server.fetch(new Request('http://localhost/app/_nuxt/entry.js'))
      expect(asset.status).toBe(200)
      expect(await asset.text()).toBe('export {}')
      expect(render).not.toHaveBeenCalled()

      expect(await (await server.fetch(new Request('http://localhost/_nuxt/entry.js'))).text()).toBe('rendered')
      expect(render.mock.calls.map(([request]) => request.url)).toEqual(['http://localhost/_nuxt/entry.js'])
    })
  })
})
