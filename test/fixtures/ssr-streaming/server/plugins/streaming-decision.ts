import { definePlugin as defineNitroPlugin } from 'nitro'
import { getQuery } from 'h3'

export default defineNitroPlugin((nitro) => {
  // Per-request streaming escape hatch. Real apps would key off auth or a
  // cookie; the query param keeps the test deterministic.
  nitro.hooks.hook('render:route', (ctx, { event }) => {
    if ('no-stream' in getQuery(event)) {
      ctx.prefersStream = false
    }
  })
})
