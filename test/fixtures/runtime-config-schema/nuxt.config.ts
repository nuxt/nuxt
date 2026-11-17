import { z } from 'zod'

import { nitroMajor } from '../../matrix.ts'

export default defineNuxtConfig({
  ...nitroMajor ? { _nitroMajor: nitroMajor } : {},
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
