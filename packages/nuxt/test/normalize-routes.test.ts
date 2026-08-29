import fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'
import { parseSync } from 'rolldown/utils'
import type { NuxtPage } from 'nuxt/schema'
import { normalizeRoutes } from '../src/pages/utils.ts'

vi.mock('@nuxt/kit', async (original) => {
  const mod = await original<typeof import('@nuxt/kit')>()
  return { ...mod, useNuxt: vi.fn(() => ({ options: { experimental: { normalizePageNames: false } } })) }
})

const pathSegment = fc.constantFrom('about', 'products', ':id()', ':slug(.*)*', '测试', 'a-b', 'quo\'te', 'back`tick', 'dollar${x}', 'back\\slash', 'new\nline')
const file = fc.constantFrom('pages/index.vue', 'pages/about.vue', 'pages/products/[id].vue', 'pages/quo\'te.vue')

const page: fc.Arbitrary<NuxtPage> = fc.letrec<{ page: NuxtPage }>(tie => ({
  page: fc.record({
    name: fc.option(fc.constantFrom('index', 'about', 'products-id', 'a.b', 'quo\'te', 'back`tick'), { nil: undefined }),
    path: fc.array(pathSegment, { minLength: 1, maxLength: 2 }).map(segments => '/' + segments.join('/')),
    file: fc.option(file, { nil: undefined }),
    meta: fc.option(fc.constantFrom({ layout: 'default' }, { middleware: ['auth'] }, {}, { title: 'it\'s ${a} `b`' }, { nested: { deep: 'new\nline' } }), { nil: undefined }),
    props: fc.option(fc.constantFrom(true, false, { a: 1 }), { nil: undefined }) as fc.Arbitrary<any>,
    alias: fc.option(fc.array(pathSegment.map(segment => '/' + segment), { minLength: 1, maxLength: 2 }), { nil: undefined }),
    redirect: fc.option(fc.constantFrom('/', '/other'), { nil: undefined }),
    children: fc.oneof(
      { weight: 3, arbitrary: fc.constant(undefined) },
      { weight: 1, arbitrary: fc.array(tie('page').map(child => ({ ...child, path: child.path.slice(1) })), { maxLength: 2 }) },
    ),
  }),
})).page

function allPages (pages: NuxtPage[]): NuxtPage[] {
  return pages.flatMap(page => [page, ...(page.children ? allPages(page.children) : [])])
}

describe('normalizeRoutes', () => {
  it('should emit parseable route definitions for any page tree', () => {
    fc.assert(fc.property(fc.array(page, { minLength: 1, maxLength: 3 }), fc.boolean(), (pages, overrideMeta) => {
      const metaImports = new Set<string>()
      const { routes, imports } = normalizeRoutes(pages, metaImports, {
        clientComponentRuntime: '<client>',
        serverComponentRuntime: '<server>',
        overrideMeta,
      })

      expect(parseSync('routes.js', `const __routes = ${routes}`, { lang: 'js' }).errors).toEqual([])
      for (const statement of imports) {
        expect(parseSync('imports.js', statement, { lang: 'js' }).errors).toEqual([])
      }

      for (const page of allPages(pages)) {
        expect(routes).toContain(JSON.stringify(page.path))
      }
    }), { numRuns: 1000 })
  })
})
