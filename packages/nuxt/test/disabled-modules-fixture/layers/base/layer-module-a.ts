import { defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'layer-module-a',
  },
  setup (_options, nuxt) {
    nuxt.options.appConfig.layerModuleA = true
  },
})
