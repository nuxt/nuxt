// https://nuxt.com/docs/api/nuxt-config
export default defineNuxtConfig({
  future: { compatibilityVersion: process.env.TEST_V4 === 'true' ? 4 : 3 },
  experimental: {
    externalVue: false,
  },
  vue: {
    runtimeCompiler: true,
  },
  builder: process.env.TEST_BUILDER as 'webpack' | 'vite' ?? 'vite',
})
