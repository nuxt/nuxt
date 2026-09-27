export default defineNuxtConfig({
  extends: ['../server-path-fallback'],
  experimental: { serverPathFallback: false },
  compatibilityDate: 'latest',
})
