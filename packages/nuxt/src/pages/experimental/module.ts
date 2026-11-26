import { defineNuxtModule } from '@nuxt/kit'
import { pagesModuleDefinition, setupPages } from '../module.ts'

/**
 * File-based routing on the experimental router of vue-router: the page routes are compiled at
 * build time into a fixed resolver, so the route table cannot change at runtime.
 */
export default defineNuxtModule({
  ...pagesModuleDefinition,
  setup: (options, nuxt) => setupPages(options, nuxt, true),
})
