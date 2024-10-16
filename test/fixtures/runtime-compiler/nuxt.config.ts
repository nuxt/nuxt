// https://nuxt.com/docs/api/nuxt-config
export default defineNuxtConfig({
  vue: {
    runtimeCompiler: true,
  },
  builder: process.env.TEST_BUILDER as 'webpack' | 'rspack' | 'vite' ?? 'vite',
  future: { compatibilityVersion: process.env.TEST_V4 === 'true' ? 4 : 3 },
  experimental: {
    externalVue: false,
  },
  compatibilityDate: '2024-06-28',
})
