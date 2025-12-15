import { defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'project-module',
  },
  setup (_options, nuxt) {
    nuxt.options.appConfig.projectModule = true
  },
})
