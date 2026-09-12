import { addImportsDir, addServerImportsDir, createResolver, defineNuxtModule } from '@nuxt/kit'

// stands in for an installed module: what it ships is a build, so its type-only exports exist
// only in the emitted declaration files
export default defineNuxtModule({
  meta: { name: 'built-module' },
  setup () {
    const resolver = createResolver(import.meta.url)
    addImportsDir(resolver.resolve('./module-dist/runtime/composables'))
    addServerImportsDir(resolver.resolve('./module-dist/runtime/server/utils'))
  },
})
