export default defineNuxtConfig({
  routeRules: {
    '/uncached': { swr: 60 },
    '/cached': { swr: 60 },
    '/moved': { redirect: { to: '/old', statusCode: 301 } },
  },
  experimental: {
    inlineRouteRules: true,
  },
})
