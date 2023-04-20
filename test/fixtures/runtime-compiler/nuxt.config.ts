// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  experimental: {
    runtimeVueCompiler: true,
    externalVue: false
  },
  builder: process.env.TEST_BUILDER as 'webpack' | 'vite' ?? 'vite'
})
