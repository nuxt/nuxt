import { defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'layer-module-c',
  },
  setup (_options, nuxt) {
    nuxt.options.appConfig.layerModuleC = true
  },
})
