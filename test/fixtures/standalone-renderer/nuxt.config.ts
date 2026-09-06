export default defineNuxtConfig({
  modules: ['./modules/renderer-artifacts'],
  devtools: { enabled: false },
  app: {
    head: {
      titleTemplate: '%s | nuxt',
    },
  },
  runtimeConfig: {
    public: {
      greeting: 'hello from runtime config',
    },
  },
  // the renderer test resolves the build artifacts through fixed paths
  buildDir: '.nuxt',
  sourcemap: false,
  compatibilityDate: 'latest',
  server: {
    builder: 'vite',
  },
})
