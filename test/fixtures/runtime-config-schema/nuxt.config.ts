import { z } from 'zod'

export default defineNuxtConfig({
  devtools: { enabled: false },
  runtimeConfig: {
    apiSecret: z.string(),
    port: z.number().default(3000),
    plain: '',
    public: {
      mode: z.enum(['preview', 'production']).default('preview'),
      flag: false,
    },
  },
  compatibilityDate: 'latest',
})
