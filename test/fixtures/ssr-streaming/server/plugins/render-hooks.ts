import { definePlugin as defineNitroPlugin } from 'nitro'

// Exercises the streaming render-hook contract. Gated to `/hooks` so the other
// streaming tests keep their unmutated output.
export default defineNitroPlugin((nitro) => {
  // `render:html` fires once before the shell flushes; `head`/`bodyPrepend`
  // mutations reach the shell. The second arg carries `streaming: true`.
  nitro.hooks.hook('render:html', (ctx, { event, streaming }) => {
    if (event.url.pathname !== '/hooks') { return }
    ctx.head.push(`<meta name="x-render-html" content="${streaming ? 'streaming' : 'buffered'}">`)
    ctx.bodyPrepend.push('<!--render:html bodyPrepend-->')
  })

  // `render:html:chunk` fires per chunk; `ctx.chunk` (bytes) is mutable and
  // `ctx.index` identifies the shell chunk.
  nitro.hooks.hook('render:html:chunk', (ctx, { event }) => {
    if (event.url.pathname !== '/hooks' || ctx.index !== 0) { return }
    ctx.chunk = new Uint8Array([...ctx.chunk, ...new TextEncoder().encode('<!--chunk:0-->')])
  })

  // `render:html:close` fires after the body stream completes; `bodyAppend`
  // injects final markup before the closing tags.
  nitro.hooks.hook('render:html:close', (ctx, { event }) => {
    if (event.url.pathname !== '/hooks') { return }
    ctx.bodyAppend.push('<!--render:html:close bodyAppend-->')
  })
})
