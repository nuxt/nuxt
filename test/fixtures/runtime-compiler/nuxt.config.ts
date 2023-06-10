// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  experimental: {
    externalVue: false
  },
  vue: {
    runtimeCompiler: true
  },
  builder: process.env.TEST_BUILDER as 'webpack' | 'vite' ?? 'vite'
})
