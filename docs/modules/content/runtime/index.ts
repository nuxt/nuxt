import { asyncData } from '@nuxt/app'

export { default as NuxtContent } from './content.vue'

export function useContent (slug) {
  return asyncData(`content:${slug}`, () => globalThis.$fetch(`/api/content${slug}`))
}
