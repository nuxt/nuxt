import { defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  defaults: {
    enabled: true
  },
  meta: {
    name: 'my-module',
    configKey: 'sampleModule'
  }
})
