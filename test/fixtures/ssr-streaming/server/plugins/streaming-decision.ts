import { definePlugin as defineNitroPlugin } from 'nitro'

export default defineNitroPlugin((nitro) => {
  // Per-request streaming escape hatch. Real apps would key off auth or a
  // cookie; the query param keeps the test deterministic.
  nitro.hooks.hook('render:route', (ctx, { event }) => {
    if (event.url.searchParams.has('no-stream')) {
      ctx.prefersStream = false
    }
  })
})
