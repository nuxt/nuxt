import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { createHooks } from 'hookable'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Nuxt, NuxtHooks } from '@nuxt/schema'

import { normalizeNitroPrerenderRoute, reportNitroPrerender, startBuildEnvironment } from '../src/internal/build-report.ts'

function createNuxt () {
  const hooks = createHooks<NuxtHooks>()
  const calls: Array<[string, ...unknown[]]> = []
  hooks.beforeEach(({ name, args }) => { calls.push([name, ...args]) })
  return { nuxt: { hooks, callHook: hooks.callHook.bind(hooks) } as unknown as Nuxt, calls }
}

describe('startBuildEnvironment', () => {
  let outDir: string

  beforeAll(async () => {
    outDir = await mkdtemp(join(tmpdir(), 'nuxt-build-report-'))
    await mkdir(join(outDir, '_nuxt'), { recursive: true })
    await writeFile(join(outDir, 'index.mjs'), 'export {}')
    await writeFile(join(outDir, '_nuxt/entry.js'), 'console.log(1)')
  })

  afterAll(async () => {
    await rm(outDir, { recursive: true, force: true })
  })

  it('reports the start and the files written', async () => {
    const { nuxt, calls } = createNuxt()
    const environment = { name: 'client', consumer: 'client', builder: 'vite' } as const

    const report = await startBuildEnvironment(environment, nuxt)
    expect(calls).toEqual([['build:environment:start', environment]])

    await report.done(outDir, ['_nuxt/entry.js', 'missing.js', '_nuxt/entry.js'])
    const [name, reported, result] = calls[1]!
    expect(name).toBe('build:environment:done')
    expect(reported).toBe(environment)
    expect(result).toEqual({
      duration: expect.any(Number),
      outDir,
      files: [{ path: '_nuxt/entry.js', size: 14 }],
    })
  })

  it('reports every file in the output directory when none are named', async () => {
    const { nuxt, calls } = createNuxt()
    const report = await startBuildEnvironment({ name: 'nitro', consumer: 'server', builder: 'rolldown' }, nuxt)
    await report.done(outDir)

    const { files } = calls[1]![2] as { files: Array<{ path: string }> }
    expect(files.map(file => file.path).sort()).toEqual(['_nuxt/entry.js', 'index.mjs'])
  })
})

describe('normalizeNitroPrerenderRoute', () => {
  it('normalises a written route', () => {
    expect(normalizeNitroPrerenderRoute({ route: '/', fileName: '/index.html', generateTimeMS: 12 }, 3)).toEqual({
      route: '/',
      duration: 12,
      total: 3,
      skipped: false,
      fileName: 'index.html',
    })
  })

  it('normalises a skipped route', () => {
    expect(normalizeNitroPrerenderRoute({ route: '/_payload.json?a=1', fileName: '/_payload.json?a=1', generateTimeMS: 3, skip: true }, 1)).toEqual({
      route: '/_payload.json?a=1',
      duration: 3,
      total: 1,
      skipped: true,
    })
  })

  it('normalises a failed route from Nitro 3', () => {
    const error = Object.assign(new Error('[404] Not Found'), { status: 404, statusText: 'Not Found' })
    expect(normalizeNitroPrerenderRoute({ route: '/missing', fileName: '/missing/index.html', generateTimeMS: 5, error }, 1)).toEqual({
      route: '/missing',
      duration: 5,
      total: 1,
      skipped: false,
      error: { status: 404, message: 'Not Found' },
    })
  })

  it('normalises a failed route from Nitro 2', () => {
    const error = Object.assign(new Error('[500] Server Error'), { statusCode: 500, statusMessage: 'Server Error' })
    expect(normalizeNitroPrerenderRoute({ route: '/broken', generateTimeMS: 7, error }, 1)).toEqual({
      route: '/broken',
      duration: 7,
      total: 1,
      skipped: false,
      error: { status: 500, message: 'Server Error' },
    })
  })

  it('falls back to the error message without a status text', () => {
    const error = Object.assign(new Error('[502] '), { status: 502, statusText: '' })
    expect(normalizeNitroPrerenderRoute({ route: '/', error }, 1).error).toEqual({ status: 502, message: '[502] ' })
  })
})

describe('reportNitroPrerender', () => {
  function setup () {
    const { nuxt, calls } = createNuxt()
    const nitroHooks = createHooks<Record<string, (...args: any[]) => any>>()
    reportNitroPrerender({ hooks: nitroHooks }, nuxt)
    return { nitroHooks, calls }
  }

  it.each([
    ['Nitro 2', { statusCode: 404, statusMessage: 'Not Found' }],
    ['Nitro 3', { status: 404, statusText: 'Not Found' }],
  ])('reports the prerendering of %s through the build hooks', async (_, fields) => {
    const { nitroHooks, calls } = setup()

    const routes = new Set(['/', '/about'])
    await nitroHooks.callHook('prerender:routes', routes)
    await nitroHooks.callHook('prerender:init', {})
    const written = { route: '/', fileName: '/index.html', generateTimeMS: 10 }
    const failed = { route: '/about', generateTimeMS: 4, error: Object.assign(new Error('[404] Not Found'), fields) }
    await nitroHooks.callHook('prerender:route', written)
    await nitroHooks.callHook('prerender:route', failed)
    await nitroHooks.callHook('prerender:done', { prerenderedRoutes: [written], failedRoutes: [failed] })

    expect(calls).toEqual([
      ['build:prerender:start', { routes: 2 }],
      ['build:prerender:route', { route: '/', duration: 10, total: 2, skipped: false, fileName: 'index.html' }],
      ['build:prerender:route', { route: '/about', duration: 4, total: 2, skipped: false, error: { status: 404, message: 'Not Found' } }],
      ['build:prerender:done', { duration: expect.any(Number), written: 1, failed: [{ route: '/about', status: 404, message: 'Not Found' }] }],
    ])
  })

  it('reports a total that grows as crawled links are queued, while nitro drains the queue', async () => {
    const { nitroHooks, calls } = setup()

    const routes = new Set(['/', '/contact'])
    await nitroHooks.callHook('prerender:routes', routes)
    await nitroHooks.callHook('prerender:init', {})

    routes.delete('/')
    routes.add('/about').add('/blog').add('/contact')
    await nitroHooks.callHook('prerender:route', { route: '/', fileName: '/index.html' })

    routes.delete('/contact')
    routes.delete('/about')
    routes.add('/blog/post')
    await nitroHooks.callHook('prerender:route', { route: '/about', fileName: '/about/index.html' })

    expect(calls.filter(([name]) => name === 'build:prerender:route').map(([, route]) => (route as { total: number }).total)).toEqual([4, 5])
  })

  it('counts the root route nitro adds to an empty set of routes to crawl', async () => {
    const { nitroHooks, calls } = setup()

    const routes = new Set<string>()
    await nitroHooks.callHook('prerender:routes', routes)
    routes.add('/')
    await nitroHooks.callHook('prerender:init', {})
    await nitroHooks.callHook('prerender:route', { route: '/', fileName: '/index.html' })

    expect(calls.slice(0, 2)).toEqual([
      ['build:prerender:start', { routes: 1 }],
      ['build:prerender:route', { route: '/', duration: 0, total: 1, skipped: false, fileName: 'index.html' }],
    ])
  })

  it('reports a total of at least the routes reported so far', async () => {
    const { nitroHooks, calls } = setup()

    await nitroHooks.callHook('prerender:init', {})
    await nitroHooks.callHook('prerender:route', { route: '/', fileName: '/index.html' })
    await nitroHooks.callHook('prerender:route', { route: '/about', fileName: '/about/index.html' })

    expect(calls.filter(([name]) => name === 'build:prerender:route').map(([, route]) => (route as { total: number }).total)).toEqual([1, 2])
  })
})
