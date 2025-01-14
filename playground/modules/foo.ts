import { defineNuxtModule, useNuxt } from 'nuxt/kit'

export default defineNuxtModule({
  setup (options, nuxt) {
    nuxt.options.alias['@foo'] = '/path/to/foo'

    const nuxt2 = useNuxt()
    nuxt2.options.buildId = 'foo'
  },
})
