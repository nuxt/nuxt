export default defineNuxtConfig({
  devtools: { enabled: false },
  routeRules: {
    // ssrStreaming defaults every route to streaming; keep the fixture buffered except
    // for the dedicated page so preload/entry assertions stay deterministic
    '/**': { streaming: false },
    '/streamed': { streaming: true },
    '/static': { prerender: true },
    '/static-hidden': { prerender: true },
    '/swr': { swr: true },
    '/spa': { ssr: false },
    '/rules-mw': { appMiddleware: 'tracker' },
  },
  features: {
    inlineStyles: false,
  },
  experimental: {
    // groupSize 1 keeps one chunk per route for deterministic on-demand assertions
    lazyRouteDiscovery: { groupSize: 1 },
    componentIslands: true,
    ssrStreaming: true,
  },
  compatibilityDate: 'latest',
})
