import { createResolver, defineNuxtModule, useNuxt } from 'nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'page-extend'
  },
  setup () {
    const nuxt = useNuxt()
    const resolver = createResolver(import.meta.url)
    nuxt.hook('pages:extend', (p) => {
      p.push(
       { 
        file: resolver.resolve('../../pages/index.vue'), 
        path: '/server-page',
         server: true,
          meta: {server: true},
        name: 'server-page' }
      )
    })
    nuxt.hook('pages:extend', (pages) => {
      pages.push({
        name: 'page-extend',
        path: '/page-extend',
        file: resolver.resolve('../runtime/page.vue')
      }, {
        path: '/big-page-1',
        file: resolver.resolve('./pages/big-page.vue')
      }, {
        path: '/big-page-2',
        file: resolver.resolve('./pages/big-page.vue')
      })
    })
  }
})
