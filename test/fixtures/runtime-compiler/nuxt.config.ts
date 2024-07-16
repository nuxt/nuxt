// https://nuxt.com/docs/api/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-06-28',
  experimental: {
    externalVue: false,
  },
  vue: {
    runtimeCompiler: true,
  },
  builder: process.env.TEST_BUILDER as 'webpack' | 'vite' ?? 'vite',
})
