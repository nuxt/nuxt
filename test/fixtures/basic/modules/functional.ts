import { join } from 'pathe'
import { defineNuxtModule } from 'nuxt/kit'

export default defineNuxtModule(
  function (_, nuxt) {
    nuxt.options.optimization.treeShake.composables.server[join(nuxt.options.rootDir, 'composables/tree-shake.ts')] = ['useClientOnlyComposable', 'setTitleToPink']
    nuxt.options.optimization.treeShake.composables.client[join(nuxt.options.rootDir, 'composables/tree-shake.ts')] = ['useServerOnlyComposable']
  },
)
