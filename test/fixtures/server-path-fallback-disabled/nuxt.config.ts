export default defineNuxtConfig({
  // the same app as `server-path-fallback`, with the feature off, so `test/bundle.test.ts`
  // can compare the two client bundles
  extends: ['../server-path-fallback'],
  experimental: { serverPathFallback: false },
  compatibilityDate: 'latest',
})
