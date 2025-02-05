export default defineNuxtConfig({
  builder: process.env.TEST_BUILDER as 'webpack' | 'rspack' | 'vite' ?? 'vite',
  experimental: {
    asyncContext: process.env.TEST_CONTEXT === 'async',
    appManifest: process.env.TEST_MANIFEST !== 'manifest-off',
    renderJsonPayloads: process.env.TEST_PAYLOAD !== 'js',
    inlineRouteRules: true,
  },
  compatibilityDate: '2024-06-28',
})
