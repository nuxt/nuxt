import { addServerImports, defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: { name: 'module-with-dep' },
  setup () {
    addServerImports([{ name: 'useModuleOnlyDep', from: 'module-only-dep' }])
  },
})
