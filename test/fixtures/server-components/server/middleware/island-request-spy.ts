import { defineEventHandler } from 'h3'

// Records the request headers of the last SSR island subrequest for `HeaderEcho`,
// so the test can assert what the page renderer actually sent (not just what the island rendered).
export default defineEventHandler((event) => {
  if (!event.url.pathname.startsWith('/__nuxt_island/HeaderEcho')) { return }
  globalThis.__islandRequestSpy = {
    cookie: event.req.headers.get('cookie'),
    authorization: event.req.headers.get('authorization'),
  }
})

declare global {
  var __islandRequestSpy: { cookie: string | null, authorization: string | null } | undefined
}
