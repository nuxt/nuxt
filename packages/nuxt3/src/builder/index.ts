import type { Nuxt } from '../core'
import { Builder } from './builder'

export { Builder } from './builder'

export function getBuilder (nuxt: Nuxt) {
  return new Builder(nuxt)
}

export function build (nuxt: Nuxt) {
  return getBuilder(nuxt).build()
}
