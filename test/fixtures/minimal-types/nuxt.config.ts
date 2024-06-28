export default defineNuxtConfig({
  future: { compatibilityVersion: process.env.TEST_V4 === 'true' ? 4 : 3 },
  compatibilityDate: '2024-06-28',
  experimental: { appManifest: true },
})
