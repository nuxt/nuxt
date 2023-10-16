import { defineNuxtModule } from 'nuxt/kit'

export default defineNuxtModule(
  function (_, nuxt) {
    nuxt.options.optimization.treeShake.composables.server[nuxt.options.rootDir] = ['useClientOnlyComposable', 'setTitleToPink']
    nuxt.options.optimization.treeShake.composables.client[nuxt.options.rootDir] = ['useServerOnlyComposable']
  }
)
