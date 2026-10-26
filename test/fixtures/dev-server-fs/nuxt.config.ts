const viteEnvironmentApi = process.env.TEST_BUILDER === 'vite-env-api'

export default defineNuxtConfig({
  devtools: { enabled: false },
  runtimeConfig: { privateValue: 'private-value' },
  buildDir: viteEnvironmentApi ? '.nuxt-vite-env-api' : '.nuxt',
  experimental: { viteEnvironmentApi },
  compatibilityDate: 'latest',
})
