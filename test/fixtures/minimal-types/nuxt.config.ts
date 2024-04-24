export default defineNuxtConfig({
  future: { v4: process.env.TEST_V4 === 'true' },
  experimental: { appManifest: true },
})
