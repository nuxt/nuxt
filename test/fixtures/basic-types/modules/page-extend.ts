import { createResolver, defineNuxtModule, useNuxt } from 'nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'page-extend'
  },
  setup () {
    const nuxt = useNuxt()
    const resolver = createResolver(import.meta.url)

    nuxt.hook('pages:extend', (pages) => {
      pages.push({
        name: 'page-extend',
        path: '/page-extend',
        file: resolver.resolve('./runtime/page.vue')
      })
    })
  }
})
