export default defineNuxtConfig({
  extends: ['../minimal-pages-many-routes'],
  experimental: {
    lazyRouteDiscovery: true,
  },
})
