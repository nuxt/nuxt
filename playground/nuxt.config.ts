export default defineNuxtConfig({
  devtools: { enabled: false },
  // Crash trigger: global SSR-off catch-all + one route that re-enables ssr and enables swr.
  routeRules: {
    '/**': {
      ssr: false,
    },
    '/': {
      ssr: true,
      swr: true,
    },
  },
  compatibilityDate: '2026-01-01',
})
