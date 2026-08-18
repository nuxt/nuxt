import { describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'nitro/h3'

import { throwIfUnmatchedPagePath } from '../src/runtime/utils/renderer/early-404.ts'

vi.mock('#internal/nuxt/nitro-config.mjs', () => ({
  NUXT_PAGE_MATCHER: (_method: string, path: string) => path === '/known' ? 1 : undefined,
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
  const routeOptions = maxAge === undefined ? {} : { cache: { options: { maxAge } } }
  try {
    throwIfUnmatchedPagePath(event(path, method), routeOptions)
  } catch (error) {
    return error as { status: number, data: { path: string }, headers: Headers | undefined }
  }
  return undefined
}

describe('throwIfUnmatchedPagePath', () => {
  it('lets paths that could match a page through', () => {
    expect(errorFor('/known')).toBeUndefined()
    expect(errorFor('/known/')).toBeUndefined()
    expect(errorFor('/known/_payload.json')).toBeUndefined()
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
