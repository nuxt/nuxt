import fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'
import { addRoute, createRouter as createRou3Router } from 'rou3'
import { compileRouterToString } from 'rou3/compiler'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'
import type { H3Event } from 'nitro/h3'
import type { NuxtPage } from 'nuxt/schema'

import { collectRou3PagePatterns } from '../../src/pages/route-patterns.ts'
import { normalizeRouteRulePath } from '../../src/core/utils/route-rules.ts'
import { encodeRoutePath, foldRouteCase } from '../../src/core/utils/index.ts'
import { throwIfUnmatchedPagePath } from '../../src/runtime/server/renderer/early-404.ts'
import type { NuxtRendererOptions } from '../../src/runtime/server/renderer/runtime.ts'

const options = {
  createError: (init: { status: number, statusText?: string, data?: unknown, headers?: Record<string, string> }) => Object.assign(new Error(init.statusText), {
    status: init.status,
    data: init.data,
    headers: init.headers ? new Headers(init.headers) : undefined,
  }),
} as unknown as NuxtRendererOptions

const knownMatcher = (_method: string, path: string) => path === '/known' ? 1 : undefined
let matcher: (method: string, path: string) => unknown = knownMatcher

vi.mock('nuxt/internal/renderer-config', () => ({
  get NUXT_PAGE_MATCHER () {
    return matcher
  },
}))

function event (path: string, method = 'GET') {
  return {
    url: new URL(path, 'http://localhost'),
    req: { method },
  } as unknown as H3Event
}

function cacheControlFor (path: string, method?: string, maxAge?: number) {
  return errorFor(path, method, maxAge)?.headers?.get('cache-control') ?? null
}

function errorFor (path: string, method?: string, maxAge?: number) {
  const routeOptions = maxAge === undefined ? {} : { cache: { maxAge } }
  try {
    throwIfUnmatchedPagePath(options, event(path, method), routeOptions)
  } catch (error) {
    return error as { status: number, data: { path: string }, headers: Headers | undefined }
  }
  return undefined
}

describe('throwIfUnmatchedPagePath', () => {
  it('lets paths that could match a page through', () => {
    expect(errorFor('/known')).toBeUndefined()
    expect(errorFor('/known/')).toBeUndefined()
    expect(errorFor('/known///')).toBeUndefined()
    expect(errorFor('/known/_payload.json')).toBeUndefined()
  })

  it('handles long runs of slashes', () => {
    expect(errorFor(`/known${'/'.repeat(200_000)}`)).toBeUndefined()
    expect(errorFor(`/known${'/'.repeat(200_000)}x`)?.status).toBe(404)
  })

  it('throws a 404 carrying the request path', () => {
    const error = errorFor('/wp-login.php?redirect=1')

    expect(error?.status).toBe(404)
    expect(error?.data.path).toBe('/wp-login.php?redirect=1')
  })

  it('advertises the cache rule maxAge on GET and HEAD misses only', () => {
    expect(cacheControlFor('/unknown', 'GET', 60)).toBe('public, max-age=60')
    expect(cacheControlFor('/unknown', 'HEAD', 60)).toBe('public, max-age=60')
    expect(cacheControlFor('/unknown', 'POST', 60)).toBeNull()
    expect(cacheControlFor('/unknown', 'GET', 0)).toBeNull()
    expect(cacheControlFor('/unknown', 'GET')).toBeNull()
  })
})

const Stub = defineComponent({ render: () => h('div') })

const pathSegment = fc.constantFrom(
  'about', 'Products', 'deep', '测试', 'a.b', 'café', 'CAFÉ', '100% legit', 'a+b', '%2Fa', 'İstanbul', 'ςίγμα', 'Σίγμα', 'σίγμα', 'ᲂкно', 'контакты',
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
    filled.replace(/σ/g, 'ς').replace(/о/g, 'ᲂ'),
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
  const match = new Function(`${compileRouterToString(router, { functionName: 'NUXT_PAGE_MATCHER' })}\nreturn NUXT_PAGE_MATCHER`)() as (method: string, path: string) => unknown
  return (method: string, path: string) => match(method, encodeRoutePath(foldRouteCase(path)))
}

describe('early 404 matching', () => {
  it('should let through every URL a page route can match', () => {
    try {
      fc.assert(fc.property(fc.array(page, { minLength: 1, maxLength: 3 }), (pages) => {
        const patterns = collectRou3PagePatterns(pages)
        fc.pre(patterns !== undefined)
        matcher = compileMatcher(patterns!)

        const router = createRouter({ history: createMemoryHistory(), routes: toVueRouterRoutes(pages) as never })
        for (const fullPath of fullPaths(pages)) {
          for (const url of candidateUrls(fullPath)) {
            if (!router.resolve(url).matched.length) { continue }
            expect(errorFor(url), `${url} (patterns: ${patterns!.join(', ')})`).toBeUndefined()
          }
        }
      }), { numRuns: 500 })
    } finally {
      matcher = knownMatcher
    }
  })
})
