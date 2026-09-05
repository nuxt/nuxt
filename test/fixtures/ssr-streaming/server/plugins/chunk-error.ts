import { definePlugin as defineNitroPlugin } from 'nitro'

// Simulates any non-Vue failure that kills the stream mid-response (here a
// module's `render:html:chunk` hook throwing). The error reaches the
// renderer's catch without the app's error normalisation, exercising the
// raw-error path of the streamed payload. See pages/chunk-error.vue.
export default defineNitroPlugin((nitro) => {
  const decoder = new TextDecoder()
  nitro.hooks.hook('render:html:chunk', (ctx, { event }) => {
    if (event.url.pathname !== '/chunk-error') { return }
    // kill on the chunk that proves the boundary resolved, so the shell and
    // fallback have already flushed
    if (decoder.decode(ctx.chunk).includes('hook (resolved after')) {
      throw new Error('chunk hook failure')
    }
  })
})
