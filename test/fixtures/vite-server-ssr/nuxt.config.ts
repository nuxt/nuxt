export default defineNuxtConfig({
  devtools: { enabled: false },
  app: {
    head: {
      title: 'Pure Vite SSR',
    },
  },
  runtimeConfig: {
    public: {
      greeting: 'hello from runtime config',
    },
  },
  sourcemap: false,
  compatibilityDate: 'latest',
  server: {
    builder: 'vite',
  },
})
