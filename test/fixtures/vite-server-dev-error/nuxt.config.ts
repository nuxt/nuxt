export default defineNuxtConfig({
  devtools: { enabled: false },
  compatibilityDate: 'latest',
  // the overlay is skipped when `test` is set, and this fixture renders it
  test: false,
  server: {
    builder: 'vite',
  },
})
