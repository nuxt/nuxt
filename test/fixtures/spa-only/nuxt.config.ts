export default defineNuxtConfig({
  devtools: { enabled: false },
  routeRules: {
    '/admin/**': { ssr: false },
    // a more specific rule carves a server-rendered exception out of the region
    '/admin/ssr': { ssr: true },
    '/products/**': { ssr: false },
    '/report': { ssr: false },
    // canonical path is client-only, but the `/aliased-alt` alias is not
    '/aliased': { ssr: false },
    '/parent/**': { ssr: false },
  },
  experimental: {
    inlineRouteRules: true,
  },
  compatibilityDate: 'latest',
})
