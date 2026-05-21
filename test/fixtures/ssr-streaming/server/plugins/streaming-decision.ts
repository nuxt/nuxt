import { definePlugin as defineNitroPlugin } from 'nitro'

export default defineNitroPlugin((nitro) => {
  // Runtime streaming escape hatch: the `render:route` hook fires once per
  // request before rendering. Disabling streaming via a query param exercises
  // the per-request decision path (e.g. real apps would key off auth state).
  nitro.hooks.hook('render:route', (ctx, { event }) => {
    if (event.url.searchParams.has('no-stream')) {
      ctx.prefersStream = false
    }
  })
})
