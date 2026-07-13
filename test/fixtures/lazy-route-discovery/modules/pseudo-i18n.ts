import { defineNuxtModule } from 'nuxt/kit'
import type { NuxtPage } from 'nuxt/schema'

// Mimics the `@nuxtjs/i18n` prefix strategy: duplicates pages per locale with
// suffixed route names, so name-based navigation (`localePath`-style) is covered.
export default defineNuxtModule({
  meta: {
    name: 'pseudo-i18n',
  },
  setup (_options, nuxt) {
    nuxt.hook('pages:extend', (pages) => {
      const localized = pages
        // eager.vue sets a custom name in `definePageMeta` which would collide when duplicated
        .filter(page => page.path !== '/eager')
        .map(page => localizePage(page, 'fa'))
      pages.push(...localized)
    })
  },
})

function localizePage (page: NuxtPage, locale: string, isChild = false): NuxtPage {
  return {
    ...page,
    name: page.name ? `${page.name}___${locale}` : undefined,
    path: isChild ? page.path : `/${locale}${page.path === '/' ? '' : page.path}`,
    alias: undefined,
    children: page.children?.map(child => localizePage(child, locale, true)),
  }
}
