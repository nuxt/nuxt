import { definePlugin as defineNitroPlugin } from 'nitro'

const SCRIPT_RE = /<script\b([^>]*>)/gi

// Simulates a CSP module stamping a per-request nonce onto `head` scripts,
// via a Nitro `render:html` hook rewriting `<script>` tags directly. Gated
// to `/nonce-by-hook` so other streaming tests stay nonce-free. The streaming
// renderer extracts this nonce from the rendered head and threads it onto
// the inline scripts it emits (bootstrap, IIFE, head pushes, island relocation).
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('render:html', (ctx, { event }) => {
    if (event.url.pathname !== '/nonce-by-hook') { return }
    const nonce = 'nonce-by-hook'
    ctx.head = ctx.head.map(html =>
      html.replace(SCRIPT_RE, (_, rest) => `<script nonce="${nonce}"` + rest,
      ))
  })
})
