import { nitroMajor } from '../../matrix.ts'

export default defineNuxtConfig({
  ...nitroMajor ? { _nitroMajor: nitroMajor } : {},
  pages: false,
  devtools: { enabled: false },
  compatibilityDate: 'latest',
})
