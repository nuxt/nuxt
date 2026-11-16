import type { H3Event } from 'nitro/h3'

/** The header Nitro's prerenderer reads additional routes to crawl from. */
const NITRO_PRERENDER_HEADER = 'x-nitro-prerender'

/** The header a Nuxt island response carries its own hints on, read by `<NuxtIsland>`. */
const NUXT_PRERENDER_HEADER = 'x-nuxt-prerender'

function encodeHints (paths: string[]): string {
  return paths.map(path => encodeURIComponent(path)).join(', ')
}

/**
 * Translate the routes collected on the event's Nuxt context into the header Nitro's
 * prerenderer reads, so that `prerenderRoutes()` and the renderer's own hints reach the
 * crawler without either of them naming a Nitro header.
 */
export function applyPrerenderHints (event: H3Event, headers: Headers = event.res.headers): void {
  const paths = event.context.nuxt?.prerenderRoutes
  if (!paths?.length) { return }

  headers.append(NITRO_PRERENDER_HEADER, encodeHints(paths))
}

/**
 * Emit the hints collected while rendering an island on the island response, which crosses
 * HTTP back to the page that embedded it. Nitro only crawls the header of HTML routes, so the
 * page forwards these onto its own context once it has read them.
 */
export function applyIslandPrerenderHints (event: H3Event): void {
  const paths = event.context.nuxt?.prerenderRoutes
  if (!paths?.length) { return }

  event.res.headers.append(NUXT_PRERENDER_HEADER, encodeHints(paths))
  event.res.headers.append(NITRO_PRERENDER_HEADER, encodeHints(paths))
}
