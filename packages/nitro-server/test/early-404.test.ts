import { createEvent } from 'h3'
import type { H3Event } from 'h3'
import { describe, expect, it, vi } from 'vitest'

import { throwIfUnmatchedPagePath } from '../src/runtime/utils/renderer/early-404.ts'

vi.mock('#internal/nuxt/nitro-config.mjs', () => ({
  NUXT_PAGE_MATCHER: (_method: string, path: string) => path === '/known' ? 1 : undefined,
}))

function event (path: string, method = 'GET') {
  const headers: Record<string, string> = {}
  const req = { method, url: path, headers: { host: 'localhost' } }
  const res = {
    setHeader: (name: string, value: string) => { headers[name] = value },
    getHeader: (name: string) => headers[name],
  }
  const h3Event = createEvent(req as any, res as any)
  return { h3Event, headers }
}

function cacheControlFor (path: string, method?: string, maxAge?: number) {
  return errorFor(path, method, maxAge)?.headers['cache-control'] ?? null
}

function errorFor (path: string, method?: string, maxAge?: number) {
  const routeOptions = maxAge === undefined ? {} : { cache: { maxAge } }
  const { h3Event, headers } = event(path, method)
  try {
    throwIfUnmatchedPagePath(h3Event as H3Event, routeOptions)
  } catch (error) {
    return { ...error as { statusCode: number, data: { path: string } }, headers }
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

    expect(error?.statusCode).toBe(404)
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
