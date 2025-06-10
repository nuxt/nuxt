// https://nuxt.com/docs/api/nuxt-config
export default defineNuxtConfig({
  vue: {
    runtimeCompiler: true,
  },
  builder: process.env.TEST_BUILDER as 'webpack' | 'rspack' | 'vite' ?? 'vite',
  experimental: {
    externalVue: false,
  },
  compatibilityDate: 'latest',
})
