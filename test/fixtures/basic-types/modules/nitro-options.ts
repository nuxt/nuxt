import { defineNuxtModule } from 'nuxt/kit'
import type { Nuxt } from 'nuxt/schema'

function readNitroOptions (_options: Nuxt['options']['nitro']) {}

export default defineNuxtModule({
  meta: { name: 'nitro-options' },
  setup (_, nuxt) {
    nuxt.hooks.hook('nitro:init', (nitro) => {
      readNitroOptions(nitro.options)
    })
  },
})
