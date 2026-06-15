import { defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'layer-module-b',
    configKey: 'layerModuleB',
  },
  setup (_options, nuxt) {
    nuxt.options.appConfig.layerModuleB = true
  },
})
