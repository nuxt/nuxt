import { nitroMajor } from '../../matrix.ts'

const viteEnvironmentApi = process.env.TEST_BUILDER === 'vite-env-api'

export default defineNuxtConfig({
  ...nitroMajor ? { _nitroMajor: nitroMajor } : {},
  devtools: { enabled: false },
  runtimeConfig: { privateValue: 'private-value' },
  buildDir: (viteEnvironmentApi ? '.nuxt-vite-env-api' : '.nuxt') + (nitroMajor ? `-nitro${nitroMajor}` : ''),
  experimental: { viteEnvironmentApi },
  compatibilityDate: 'latest',
})
