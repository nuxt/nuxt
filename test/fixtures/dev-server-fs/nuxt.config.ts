const nitroViteEnvironment = process.env.TEST_NITRO_VITE_ENVIRONMENT !== 'false'

export default defineNuxtConfig({
  devtools: { enabled: false },
  runtimeConfig: { privateValue: 'private-value' },
  buildDir: nitroViteEnvironment ? '.nuxt' : '.nuxt-nitro-vite-off',
  experimental: { nitroViteEnvironment },
  compatibilityDate: 'latest',
})
