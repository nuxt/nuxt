import { nitroMajor } from '../../matrix.ts'

export default defineNuxtConfig({
  ...nitroMajor ? { _nitroMajor: nitroMajor } : {},
  devtools: { enabled: false },
  experimental: {
    staticRoutes: true,
  },
  compatibilityDate: 'latest',
})
