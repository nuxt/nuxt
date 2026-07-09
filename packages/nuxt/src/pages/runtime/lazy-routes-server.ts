import type { RouteRecordRaw } from 'vue-router'
import { defineEventHandler, getQuery } from 'nitro/h3'
import type { EventHandler } from 'nitro/h3'
import { createLazyRouteResolver } from './lazy-routes-resolver'
import type { LazyRouteResolveResponse } from './lazy-routes-resolver'
// @ts-expect-error virtual file
import { routeStubs } from '#internal/nuxt/route-stubs.mjs'

// Fog-of-war discovery endpoint: the client queries it for routes it has not yet discovered.

const resolver = createLazyRouteResolver(routeStubs as RouteRecordRaw[])

const handler: EventHandler = defineEventHandler((event): LazyRouteResolveResponse => {
  const query = getQuery(event)
  // client versions the URL with the build id (like payload URLs), so the response is immutable
  event.res.headers.set('cache-control', 'public, max-age=31536000, immutable')

  const toStringArray = (value: unknown) => (Array.isArray(value) ? value : [value]).filter((v): v is string => typeof v === 'string')
  const paths = toStringArray(query.path)
  const names = toStringArray(query.name)

  // query-less request returns the whole table — prerendered as the static-hosting fallback
  if (!paths.length && !names.length) {
    return { records: resolver.all() }
  }

  return resolver.resolveQuery({ paths, names })
})

export default handler
