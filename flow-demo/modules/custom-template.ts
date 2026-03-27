import { addTemplate, defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  setup () {
    addTemplate({ filename: 'generated.mjs' })
  },
})
