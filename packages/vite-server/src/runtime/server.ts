import { joinURL } from 'ufo'
import { resolveServerFetchInit } from 'nuxt/internal/server-default'
import type { AppRouteRules, RequestEvent, ServerFetchInit } from 'nuxt/server'

import type { MatchRouteRules } from './renderer.ts'

type AppFetch = (request: Request) => Promise<Response>

/** The `nuxt/server` helpers backed by the build's route rules and app handler. */
export function createServerHelpers (match: MatchRouteRules, loadFetch: () => Promise<AppFetch>, baseURL: string) {
  return {
    getRouteRules: (event: Pick<RequestEvent, 'url'>): AppRouteRules => match(event.url.pathname) as AppRouteRules,
    matchRouteRules: (path: string, _method?: string): AppRouteRules => match(joinURL(baseURL, path)) as AppRouteRules,
    serverFetch: async (event: Pick<RequestEvent, 'req'>, path: string, init?: ServerFetchInit): Promise<Response> => {
      const fetch = await loadFetch()
      return fetch(new Request(new URL(joinURL(baseURL, path), event.req.url), resolveServerFetchInit(event, init)))
    },
  }
}
