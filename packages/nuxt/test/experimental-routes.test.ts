import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, describe, expect, it, vi } from 'vitest'
import type { NuxtPage } from 'nuxt/schema'
import type { EXPERIMENTAL_RouteRecordNormalized_Matchable, EXPERIMENTAL_RouterOptions } from 'vue-router/experimental'
import routerOptions from '#build/router.options.mjs'
import { genExperimentalRoutes } from '../src/pages/experimental/routes.ts'

vi.mock('@nuxt/kit', async (original) => {
  const mod = await original<typeof import('@nuxt/kit')>()
  const nuxt = { options: { rootDir: '/app', experimental: { normalizePageNames: false } } }
  return { ...mod, useNuxt: vi.fn(() => nuxt) }
})

const matchersModule = new URL('../src/pages/runtime/experimental/matchers.ts', import.meta.url).pathname

const pages: NuxtPage[] = [
  { name: 'index', path: '/', file: '/app/pages/index.vue' },
  { name: 'about', path: '/about', file: '/app/pages/about.vue', alias: ['/a-propos'], meta: { layout: 'custom' } },
  { name: 'users-id', path: '/users/:id()', file: '/app/pages/users/[id].vue', props: true },
  { name: 'user-id', path: '/user-:id()', file: '/app/pages/user-[id].vue' },
  { name: 'opt', path: '/opt/:x?', file: '/app/pages/opt/[[x]].vue' },
  {
    name: 'parent',
    path: '/parent',
    file: '/app/pages/parent.vue',
    children: [
      { name: 'parent-index', path: '', file: '/app/pages/parent/index.vue' },
      { name: 'parent-child', path: 'child', file: '/app/pages/parent/child.vue' },
    ],
  },
  { name: 'old', path: '/old', file: '/app/pages/old.vue', redirect: '/about' },
  { name: 'files', path: '/files/:path(.*)', file: '/app/pages/files/[...path].vue' },
  { name: 'slug', path: '/:slug(.*)*', file: '/app/pages/[...slug].vue' },
]

const dir = mkdtempSync(join(tmpdir(), 'nuxt-experimental-routes-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

type Resolver = EXPERIMENTAL_RouterOptions['resolver']
type RoutesModule = { records: EXPERIMENTAL_RouteRecordNormalized_Matchable[], resolver: Resolver, prerenderPaths: string[] }

function generate (pages: NuxtPage[], sensitive = false, onRuntimePath?: (page: NuxtPage, keys: string[]) => void): string {
  return genExperimentalRoutes(pages, new Set(), {
    sensitive,
    matchersModule,
    clientComponentRuntime: '/client',
    serverComponentRuntime: '/server',
    overrideMeta: true,
    onRuntimePath,
  })
}

async function load (pages: NuxtPage[], sensitive = false): Promise<{ code: string } & RoutesModule> {
  const code = generate(pages, sensitive)
  const file = join(dir, `routes-${Math.random().toString(36).slice(2)}.mjs`)
  writeFileSync(file, code)
  routerOptions.sensitive = sensitive
  const mod = await import(/* @vite-ignore */ pathToFileURL(file).href) as RoutesModule
  return { code, ...mod }
}

describe('experimental routes', () => {
  it('matches paths like the classic router', async () => {
    const { resolver, records } = await load(pages)
    const resolve = (path: `/${string}`) => {
      const { name, params, matched } = resolver.resolve(path)
      return { name, params, matched: matched.map(record => record.name) }
    }

    expect(resolve('/')).toEqual({ name: 'index', params: {}, matched: ['index'] })
    expect(resolve('/users/42')).toEqual({ name: 'users-id', params: { id: '42' }, matched: ['users-id'] })
    expect(resolve('/users/42/')).toMatchObject({ name: 'users-id' })
    expect(resolve('/users/a%20b')).toMatchObject({ params: { id: 'a b' } })
    expect(resolve('/user-7')).toEqual({ name: 'user-id', params: { id: '7' }, matched: ['user-id'] })
    expect(resolve('/opt')).toEqual({ name: 'opt', params: { x: null }, matched: ['opt'] })
    expect(resolve('/opt/1')).toMatchObject({ name: 'opt', params: { x: '1' } })
    expect(resolve('/parent')).toEqual({ name: 'parent-index', params: {}, matched: ['parent', 'parent-index'] })
    expect(resolve('/parent/child')).toEqual({ name: 'parent-child', params: {}, matched: ['parent', 'parent-child'] })
    expect(resolve('/files/a/b/c')).toMatchObject({ name: 'files', params: { path: 'a/b/c' } })
    expect(resolve('/some/thing')).toEqual({ name: 'slug', params: { slug: ['some', 'thing'] }, matched: ['slug'] })
    expect(resolve('/about/more')).toMatchObject({ name: 'slug' })
    expect(resolve('/ABOUT')).toMatchObject({ name: 'about' })

    // the ranking of the classic router: the alias of `about` is a record of its own
    expect(records.map(record => record.name)).toEqual(['parent-child', 'users-id', 'opt', 'files', 'index', 'about', 'about', 'parent-index', 'parent', 'old', 'user-id', 'slug'])
  })

  it('keeps every index child when several parents have one', async () => {
    const { resolver } = await load([
      { name: 'a-layout', path: '/a', file: '/app/pages/a.vue', children: [{ name: 'a', path: '', file: '/app/pages/a/index.vue' }] },
      { name: 'b-layout', path: '/b', file: '/app/pages/b.vue', children: [{ name: 'b', path: '', file: '/app/pages/b/index.vue' }, { name: 'b-c', path: 'c', file: '/app/pages/b/c.vue' }] },
    ])
    expect(resolver.resolve('/a').matched.map(record => record.name)).toEqual(['a-layout', 'a'])
    expect(resolver.resolve('/b').matched.map(record => record.name)).toEqual(['b-layout', 'b'])
    expect(resolver.resolve('/b/c').matched.map(record => record.name)).toEqual(['b-layout', 'b-c'])
  })

  it('resolves aliases to the original record', async () => {
    const { resolver } = await load(pages)
    const alias = resolver.resolve('/a-propos')
    expect(alias.name).toBe('about')
    expect(alias.matched[0]!.aliasOf).toBe(resolver.getRoute('about'))
    expect(alias.matched[0]!.meta).toEqual({ layout: 'custom' })
    expect(resolver.resolve({ name: 'about', params: {} }).path).toBe('/about')
  })

  it('builds paths like the classic router', async () => {
    const { resolver } = await load(pages)
    const build = (name: string, params: Record<string, unknown> = {}) => resolver.resolve({ name, params }).fullPath
    expect(build('index')).toBe('/')
    expect(build('users-id', { id: 'a b/c' })).toBe('/users/a%20b%2Fc')
    expect(build('user-id', { id: '7' })).toBe('/user-7')
    expect(build('opt')).toBe('/opt')
    expect(build('opt', { x: '1' })).toBe('/opt/1')
    expect(build('parent-index')).toBe('/parent')
    expect(build('parent-child')).toBe('/parent/child')
    expect(build('files', { path: 'a/b c' })).toBe('/files/a/b%20c')
    expect(build('slug', { slug: ['a', 'b c'] })).toBe('/a/b%20c')
    expect(build('slug', { slug: [] })).toBe('/')
  })

  it('shares path matchers between a parent and its index child', async () => {
    const { resolver } = await load(pages)
    const [parent, index] = resolver.resolve('/parent').matched
    expect(parent!.path).toBe(index!.path)
    expect(resolver.getRoute('about')!.path).not.toBe(resolver.getRoute('index')!.path)
  })

  it('respects case sensitivity', async () => {
    const { resolver } = await load(pages, true)
    expect(resolver.resolve('/ABOUT').name).toBe('slug')
    expect(resolver.resolve('/USERS/1').name).toBe('slug')
    expect(resolver.resolve('/users/1').name).toBe('users-id')
  })

  it('lists static paths to prerender and keeps components lazy', async () => {
    const { prerenderPaths, code, records } = await load(pages)
    expect(prerenderPaths).toEqual(['/', '/about', '/parent', '/parent/child', '/old'])
    expect(code).toContain('import("/app/pages/users/[id].vue")')
    expect(typeof records.find(record => record.name === 'users-id')!.components!.default).toBe('function')
    expect(records.find(record => record.name === 'users-id')!.props).toEqual({ default: true })
    expect(records.find(record => record.name === 'old')!.redirect).toBe('/about')
  })

  it('reports page paths that are only known at runtime', async () => {
    const { dynamicPageMetaCache } = await import('../src/pages/page-meta-extraction.ts')
    const { useNuxt } = await import('@nuxt/kit')
    dynamicPageMetaCache(useNuxt()).set('/app/pages/dynamic.vue', new Set(['path']))
    const reported: [string | undefined, string[]][] = []
    const code = generate([{ name: 'dynamic', path: '/dynamic', file: '/app/pages/dynamic.vue' }], false, (page, keys) => reported.push([page.file, keys]))
    expect(reported).toEqual([['/app/pages/dynamic.vue', ['path']]])
    // the path scanned from the file is compiled instead of the runtime value
    expect(code).toContain('new StaticPathMatcher("/dynamic")')
  })
})
