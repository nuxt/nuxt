import { createResolver, defineNuxtModule } from 'nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'gen-routes',
  },
  setup (_options, nuxt) {
    const resolver = createResolver(import.meta.url)
    nuxt.hook('pages:extend', (pages) => {
      for (let i = 0; i < 40; i++) {
        pages.push({
          name: `gen-${i}`,
          path: `/gen/${i}`,
          file: resolver.resolve('../gen-page.vue'),
          meta: {
            title: `Generated page ${i}`,
            description: `A representative page description for generated page number ${i} in the many-routes fixture`,
            section: i % 2 === 0 ? 'even-section' : 'odd-section',
            order: i,
            breadcrumbs: ['home', 'generated', `page-${i}`],
          },
        })
      }
    })
  },
})
