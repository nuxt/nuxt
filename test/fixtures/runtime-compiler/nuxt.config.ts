// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  experimental: {
    runtimeVueCompiler: true
  },
  vue: {
    externalLib: false
  },
  builder: process.env.TEST_BUILDER as 'webpack' | 'vite' ?? 'vite'
})
