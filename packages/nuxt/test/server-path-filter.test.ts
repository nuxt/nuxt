import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { rm } from 'node:fs/promises'

import type { BloomFilter } from '../src/pages/server-path-filter'
import { collectPublicAssetPaths, collectServerRoutes, createServerPathFilter, renderServerPathFilterModule, serverPathFilterLocations } from '../src/pages/server-path-filter'

function testFilter (filter: BloomFilter, value: string): boolean {
  return serverPathFilterLocations(value, filter.hashCount, filter.bitCount)
    .every(n => filter.bits[n >> 3]! & (1 << (n & 7)))
}

const root = mkdtempSync(join(tmpdir(), 'nuxt-server-path-filter-'))
afterAll(() => rm(root, { recursive: true, force: true }))

function createDir (name: string, files: string[]) {
  const dir = join(root, name)
  for (const file of files) {
    mkdirSync(dirname(join(dir, file)), { recursive: true })
    writeFileSync(join(dir, file), 'x')
  }
  return dir
}

async function loadGeneratedModule (source: string) {
  return await import(/* @vite-ignore */ 'data:text/javascript,' + encodeURIComponent(source)) as {
    serverPathFallback: boolean
    mightBeServerPath: (path: string) => boolean
  }
}

describe('collectPublicAssetPaths', () => {
  const clientBuildDir = join(root, '.nuxt/dist/client')

  it('collects nested files from every asset directory', () => {
    const project = createDir('project-public', ['proposal.pdf', 'images/logo.svg'])
    const layer = createDir('layer-public', ['layer.txt'])

    const paths = collectPublicAssetPaths([{ dir: project, baseURL: '/' }, { dir: layer, baseURL: '/' }], { clientBuildDir, buildAssetsDir: '/_nuxt/', baseURL: '/' })

    expect([...paths].sort()).toEqual(['/images/logo.svg', '/layer.txt', '/proposal.pdf'])
  })

  it('honours a per-asset baseURL, as used by module-contributed directories', () => {
    const moduleAssets = createDir('module-assets', ['inter.woff2', 'subset/latin.woff2'])

    const paths = collectPublicAssetPaths([{ dir: moduleAssets, baseURL: '/fonts' }], { clientBuildDir, buildAssetsDir: '/_nuxt/', baseURL: '/' })

    expect([...paths].sort()).toEqual(['/fonts/inter.woff2', '/fonts/subset/latin.woff2'])
  })

  it('stores paths as the router sees them, with the app baseURL removed', () => {
    const project = createDir('based-public', ['proposal.pdf'])

    const paths = collectPublicAssetPaths([{ dir: project, baseURL: '/base/' }], { clientBuildDir, buildAssetsDir: '/_nuxt/', baseURL: '/base/' })

    expect([...paths]).toEqual(['/proposal.pdf'])
  })

  it('skips the client build output', () => {
    const project = createDir('with-build-output', ['proposal.pdf'])
    const buildDir = createDir('.nuxt/dist/client', ['_nuxt/entry.js'])

    const paths = collectPublicAssetPaths([{ dir: project }, { dir: buildDir, baseURL: '/_nuxt/' }], { clientBuildDir, buildAssetsDir: '/_nuxt/', baseURL: '/' })

    expect([...paths]).toEqual(['/proposal.pdf'])
  })

  it('skips build assets and the app manifest, which are never navigated to', () => {
    const project = createDir('with-manifest', ['proposal.pdf'])
    const manifest = createDir('manifest', ['latest.json', 'meta/build-id.json'])

    const paths = collectPublicAssetPaths([{ dir: project }, { dir: manifest, baseURL: '/_nuxt/builds' }], { clientBuildDir, buildAssetsDir: '/_nuxt/', baseURL: '/' })

    expect([...paths]).toEqual(['/proposal.pdf'])
  })

  it('ignores a directory that does not exist', () => {
    expect(collectPublicAssetPaths([{ dir: join(root, 'nope') }], { clientBuildDir, buildAssetsDir: '/_nuxt/', baseURL: '/' }).size).toBe(0)
  })
})

describe('collectServerRoutes', () => {
  const handler = (route: string, method?: string) => ({ route, method, handler: 'handler.ts' } as Parameters<typeof collectServerRoutes>[0][number])

  it('collects `GET` and method-less routes, and skips other methods', () => {
    const { paths } = collectServerRoutes([
      handler('/rss.xml', 'get'),
      handler('/sitemap.xml'),
      handler('/subscribe', 'post'),
      handler('/api/items', 'delete'),
    ], { baseURL: '/' })

    expect([...paths].sort()).toEqual(['/rss.xml', '/sitemap.xml'])
  })

  it('skips middleware and a root-level catch-all, which cover every path', () => {
    const { paths, shapes } = collectServerRoutes([
      { route: '/**', middleware: true, handler: 'middleware.ts' },
      handler('/**'),
      handler('/rss.xml'),
    ], { baseURL: '/' })

    expect([...paths]).toEqual(['/rss.xml'])
    expect([...shapes]).toEqual([])
  })

  it('replaces a parameter, and everything after a wildcard, with a placeholder', () => {
    const { shapes } = collectServerRoutes([
      handler('/og/:slug'),
      handler('/api/users/:id/avatar'),
      handler('/files/**'),
      handler('/files/**:path'),
    ], { baseURL: '/' })

    expect([...shapes]).toEqual(['/og/\u0001', '/api/users/\u0001/avatar', '/files/\u0002'])
  })

  it('removes the app baseURL', () => {
    const { paths, shapes } = collectServerRoutes([handler('/base/feed.xml'), handler('/base/og/:slug')], { baseURL: '/base/' })

    expect([...paths]).toEqual(['/feed.xml'])
    expect([...shapes]).toEqual(['/og/\u0001'])
  })
})

describe('server path filter', () => {
  const paths = Array.from({ length: 500 }, (_, i) => `/assets/file-${i}.png`)
  const filter = createServerPathFilter(paths)

  it('never rejects a path that is in it', async () => {
    const { mightBeServerPath } = await loadGeneratedModule(renderServerPathFilterModule(filter))

    expect(paths.filter(path => !mightBeServerPath(path))).toEqual([])
  })

  it('agrees with the build-time filter on every path', async () => {
    const { mightBeServerPath } = await loadGeneratedModule(renderServerPathFilterModule(filter))
    const probes = [...paths, ...Array.from({ length: 5000 }, (_, i) => `/probe-${i.toString(36)}/${(i * 7919).toString(36)}`)]

    const disagreements = probes.filter(path => mightBeServerPath(path) !== testFilter(filter.paths, path))

    expect(disagreements).toEqual([])
  })

  it('keeps false positives within the configured rate, over the shapes each lookup tests', async () => {
    const { mightBeServerPath } = await loadGeneratedModule(renderServerPathFilterModule(filter))
    const probes = Array.from({ length: 20000 }, (_, i) => `/not/an/asset/${i.toString(36)}/${(i * 7919).toString(36)}`)

    const positives = probes.filter(path => mightBeServerPath(path)).length

    expect(positives / probes.length).toBeLessThan(0.03)
  })

  it('matches a path against the shape of a route with a parameter or a wildcard', async () => {
    const { shapes } = collectServerRoutes([
      { route: '/og/:slug', handler: 'og.ts' },
      { route: '/api/users/:id/avatar', handler: 'avatar.ts' },
      { route: '/files/**', handler: 'files.ts' },
    ], { baseURL: '/' })
    const { mightBeServerPath } = await loadGeneratedModule(renderServerPathFilterModule(createServerPathFilter([], shapes)))

    expect(mightBeServerPath('/og/hello')).toBe(true)
    expect(mightBeServerPath('/api/users/17/avatar')).toBe(true)
    expect(mightBeServerPath('/files/nested/deeply/file.txt')).toBe(true)
    expect(mightBeServerPath('/og/hello/nested')).toBe(false)
    expect(mightBeServerPath('/api/users/17')).toBe(false)
  })

  it('stays small', () => {
    expect(renderServerPathFilterModule(filter).length).toBeLessThan(1600)
  })

  it('ships no shape machinery when no route needs it', () => {
    const source = renderServerPathFilterModule(filter)

    expect(source).not.toContain('shapeOf')
  })

  it('ships no path or route shape, so neither can be recovered from it', () => {
    const { shapes } = collectServerRoutes([{ route: '/api/users/:id/avatar', handler: 'avatar.ts' }], { baseURL: '/' })
    const source = renderServerPathFilterModule(createServerPathFilter(['/rss.xml'], shapes))

    expect(source).not.toContain('rss')
    expect(source).not.toContain('users')
  })
})

describe('generated module', () => {
  it('matches nothing, and can be dropped from the bundle, when disabled', async () => {
    const source = renderServerPathFilterModule(false)
    const { serverPathFallback, mightBeServerPath } = await loadGeneratedModule(source)

    expect(serverPathFallback).toBe(false)
    expect(mightBeServerPath('/proposal.pdf')).toBe(false)
    expect(source).not.toContain('atob')
  })

  it('matches everything when the file list cannot be trusted, as in dev', async () => {
    const { serverPathFallback, mightBeServerPath } = await loadGeneratedModule(renderServerPathFilterModule(undefined))

    expect(serverPathFallback).toBe(true)
    expect(mightBeServerPath('/anything-at-all')).toBe(true)
  })

  it('disables itself when there is nothing to fall back to', async () => {
    const { serverPathFallback, mightBeServerPath } = await loadGeneratedModule(renderServerPathFilterModule(createServerPathFilter([])))

    expect(serverPathFallback).toBe(false)
    expect(mightBeServerPath('/proposal.pdf')).toBe(false)
  })
})

describe('e2e fixture assumptions', () => {
  // `test/fixtures/server-path-fallback` needs `/changelog` to be a false positive of
  // the filter built from its `public/` directory and server routes. If this fails, pick a new
  // colliding path for the fixture.
  it('keeps the collision the e2e fixture depends on', async () => {
    const routes = collectServerRoutes([
      { route: '/rss.xml', method: 'GET', handler: 'rss.ts' },
      { route: '/og/:slug', handler: 'og.ts' },
      { route: '/subscribe', method: 'POST', handler: 'subscribe.ts' },
    ], { baseURL: '/' })
    const filter = createServerPathFilter([...routes.paths, '/proposal.pdf', '/proposal.txt'], routes.shapes)
    const { mightBeServerPath } = await loadGeneratedModule(renderServerPathFilterModule(filter))

    expect(mightBeServerPath('/changelog')).toBe(true)
    expect(mightBeServerPath('/definitely-not-a-route')).toBe(false)
    expect(mightBeServerPath('/subscribe')).toBe(false)
  })
})
