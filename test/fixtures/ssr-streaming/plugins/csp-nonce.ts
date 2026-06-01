export default defineNuxtPlugin((nuxtApp) => {
  // Simulates a CSP module stamping a per-request nonce onto head scripts.
  // Gated to `/nonce` so the other streaming tests keep their nonce-free
  // output. The streaming renderer extracts this nonce from the rendered head
  // and threads it onto the inline scripts it emits (bootstrap, IIFE, head
  // pushes, island relocation).
  if (nuxtApp.ssrContext?.url !== '/nonce') { return }
  useHead({
    script: [{ key: 'csp-probe', innerHTML: 'window.__cspProbe=1', nonce: 'test-csp-nonce' }],
  })
})
