export default defineNuxtConfig({
  extends: ['../fetch-global'],
  experimental: {
    globalFetch: true,
  },
})
