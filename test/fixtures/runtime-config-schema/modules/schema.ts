import { defineNuxtModule, updateRuntimeConfig } from 'nuxt/kit'
import { z } from 'zod'

export default defineNuxtModule({
  setup () {
    updateRuntimeConfig({
      moduleToken: z.string(),
      moduleCount: z.number().default(1),
    })
  },
})
