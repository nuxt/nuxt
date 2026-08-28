import fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'
import { addRoute, createRouter as createRou3Router } from 'rou3'
import { compileRouterToString } from 'rou3/compiler'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'
import type { H3Event } from 'nitro/h3'
import type { NuxtPage } from 'nuxt/schema'

import { collectRou3PagePatterns } from '../../nuxt/src/pages/utils.ts'
import { normalizeRouteRulePath } from '../../nuxt/src/core/utils/route-rules.ts'
import { throwIfUnmatchedPagePath } from '../src/runtime/utils/renderer/early-404.ts'

let matcher: ((method: string, path: string) => unknown) | undefined

vi.mock('#internal/nuxt/nitro-config.mjs', () => ({
  get NUXT_PAGE_MATCHER () {
    return matcher
  },
}))

const Stub = defineComponent({ render: () => h('div') })

const pathSegment = fc.constantFrom(
  'about', 'Products', 'deep', '测试', 'a.b', 'café', 'CAFÉ', '100% legit', 'a+b', '%2Fa', 'İstanbul',
  ':id()', ':id?', ':slug(.*)*', ':id(\\d+)', ':a()-:b()',
)

const page: fc.Arbitrary<NuxtPage> = fc.letrec<{ page: NuxtPage }>(tie => ({
  page: fc.record({
    path: fc.array(pathSegment, { minLength: 1, maxLength: 3 }).map(segments => '/' + segments.join('/')),
    alias: fc.oneof(
      { weight: 3, arbitrary: fc.constant(undefined) },
      { weight: 1, arbitrary: fc.array(pathSegment.map(segment => '/' + segment), { minLength: 1, maxLength: 2 }) },
    ),
    children: fc.oneof(
      { weight: 3, arbitrary: fc.constant(undefined) },
      { weight: 1, arbitrary: fc.array(tie('page').map(child => ({ ...child, path: child.path.slice(1) })), { maxLength: 2 }) },
    ),
  }),
})).page

function toVueRouterRoutes (pages: NuxtPage[]) {
  return pages.map((page) => {
    const route: Record<string, unknown> = { path: page.path, component: Stub }
    if (page.alias) { route.alias = page.alias }
    if (page.children) { route.children = toVueRouterRoutes(page.children) }
    return route
  })
}

function fullPaths (pages: NuxtPage[], prefix = ''): string[] {
  return pages.flatMap((page) => {
    const path = page.path.startsWith('/') ? page.path : `${prefix}/${page.path}`
    const aliases = (Array.isArray(page.alias) ? page.alias : page.alias ? [page.alias] : [])
      .map(alias => alias.startsWith('/') ? alias : `${prefix}/${alias}`)
    return [path, ...aliases, ...(page.children ? fullPaths(page.children, path) : [])]
  })
}

function candidateUrls (fullPath: string): string[] {
  const filled = fullPath
    .replace(/:\w+\(\.\*\)\*/g, 'a/b')
    .replace(/:\w+\(\\d\+\)/g, '42')
    .replace(/:\w+\?/g, 'x')
    .replace(/:\w+\(\)/g, 'x')
  const withoutOptionalParams = fullPath
    .replace(/\/:\w+\?/g, '')
    .replace(/:\w+\(\.\*\)\*/g, '')
    .replace(/:\w+\(\\d\+\)/g, '7')
    .replace(/:\w+\(\)/g, 'Y') || '/'
  return [...new Set([
    filled,
    withoutOptionalParams,
    filled.toUpperCase(),
    filled.toLowerCase(),
    encodeURI(filled),
    filled + '/',
    filled + '/_payload.json',
  ])].filter(url => url.startsWith('/') && !url.includes('//'))
}

function compileMatcher (patterns: string[]) {
  const router = createRou3Router()
  for (const pattern of new Set(patterns.map(pattern => normalizeRouteRulePath(pattern, true)))) {
    addRoute(router, '', pattern, 1)
  }
  return new Function(`${compileRouterToString(router, 'NUXT_PAGE_MATCHER')}\nreturn NUXT_PAGE_MATCHER`)() as (method: string, path: string) => unknown
}

function isEarly404 (url: string) {
  try {
    throwIfUnmatchedPagePath({ url: new URL(url, 'http://localhost'), req: { method: 'GET' } } as unknown as H3Event, {})
    return false
  } catch {
    return true
  }
}

describe('early 404 matching', () => {
  it('should let through every URL a page route can match', () => {
    fc.assert(fc.property(fc.array(page, { minLength: 1, maxLength: 3 }), (pages) => {
      const patterns = collectRou3PagePatterns(pages)
      fc.pre(patterns !== undefined)
      matcher = compileMatcher(patterns!)

      const router = createRouter({ history: createMemoryHistory(), routes: toVueRouterRoutes(pages) as never })
      for (const fullPath of fullPaths(pages)) {
        for (const url of candidateUrls(fullPath)) {
          if (!router.resolve(url).matched.length) { continue }
          expect(isEarly404(url), `${url} (patterns: ${patterns!.join(', ')})`).toBe(false)
        }
      }
    }), { numRuns: 500 })
  })
})
