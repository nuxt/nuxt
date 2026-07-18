export default defineNuxtConfig({
  $production: {
    vite: {
      $client: {
        build: {
          rolldownOptions: {
            output: {
              chunkFileNames: '_nuxt/[name].js',
              entryFileNames: '_nuxt/[name].js',
            },
          },
        },
      },
    },
  },
  devtools: { enabled: false },
  sourcemap: false,
  compatibilityDate: 'latest',
  typescript: {
    typeCheck: 'build',
  },
  // eslint-disable-next-line nuxt/no-nuxt-config-test-key
  test: false,
})
