import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { createHooks } from 'hookable'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Nuxt, NuxtHooks, NuxtPrerenderRoute } from '@nuxt/schema'
import type { RendererEvent } from 'nuxt/internal/renderer/runtime'
import { prerenderDiagnostics } from 'nuxt/internal/renderer/diagnostics'

import { prerenderRoutes } from '../src/prerender.ts'
import { createPrerenderOptions } from '../src/runtime/prerender.ts'

const event = (url: string) => ({ url: new URL(url, 'http://localhost') }) as RendererEvent

const pages: Record<string, string> = {
  '/base': '<a href="/base/about">about</a><a href="/base/blog">blog</a>',
  '/base/blog': '<a href="/base/blog/one">one</a><a href="/base/blog/two">two</a><a href="/base/missing">missing</a>',
}

describe('createPrerenderOptions', () => {
  it('responds with 508 to a request for a URL that is already rendering', async () => {
    const loop = vi.spyOn(prerenderDiagnostics, 'NUXT_E8018').mockImplementation(() => ({}) as any)
    const { wrapRender } = createPrerenderOptions()

    const nested = wrapRender!(event('/page'), () => wrapRender!(event('/other'), () => wrapRender!(event('/page'), () => Promise.resolve(new Response('page')))))

    expect((await nested).status).toBe(508)
    expect(loop).toHaveBeenCalledOnce()
    expect(loop).toHaveBeenCalledWith({ url: '/page', chain: '`/page` -> `/other` -> `/page`' })
  })
})

describe('vite server prerender', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nuxt-vite-server-prerender-'))
    await writeFile(join(dir, 'handler.mjs'), [
      `const pages = ${JSON.stringify(pages)}`,
      'export async function fetch (request) {',
      '  const { pathname } = new URL(request.url)',
      '  if (pathname === \'/base/missing\') { return new Response(\'\', { status: 404, statusText: \'Not Found\' }) }',
      '  return new Response(`<html><body>${pages[pathname] ?? \'\'}</body></html>`, { headers: { \'content-type\': \'text/html\' } })',
      '}',
    ].join('\n'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  async function prerender (routes: string[]) {
    const hooks = createHooks<NuxtHooks>()
    const nuxt = {
      options: {
        app: { baseURL: '/base/' },
        routeRules: {},
        router: { options: { sensitive: false, hashMode: false } },
        nitro: { prerender: { concurrency: 2, interval: 5, failOnError: false } },
        prerender: { routes, crawlLinks: true },
        experimental: { prerenderErrorPages: false },
      },
      apps: {},
      hooks,
      callHook: hooks.callHook.bind(hooks),
    } as unknown as Nuxt

    const result = {
      start: undefined as { routes: number } | undefined,
      routes: [] as NuxtPrerenderRoute[],
      done: [] as Parameters<NuxtHooks['build:prerender:done']>[0][],
    }
    hooks.hook('build:prerender:start', (info) => { result.start = info })
    hooks.hook('build:prerender:route', (route) => { result.routes.push(route) })
    hooks.hook('build:prerender:done', (done) => { result.done.push(done) })

    await prerenderRoutes(nuxt, { publicDir: join(dir, 'public'), handler: join(dir, 'handler.mjs') })
    return result
  }

  it('reports routes without the base URL', async () => {
    const { routes, done } = await prerender(['/'])

    expect(routes.map(route => route.route).sort()).toEqual(['/', '/200.html', '/404.html', '/about', '/blog', '/blog/one', '/blog/two', '/missing'])
    expect(done[0]!.failed).toEqual([{ route: '/missing', status: 404, message: 'Not Found' }])
  })
})
