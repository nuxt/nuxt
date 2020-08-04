import type { Nuxt } from 'src/core'

import Builder from './builder'
export { default as Builder } from './builder'

export function getBuilder (nuxt: Nuxt) {
  return new Builder(nuxt)
}

export function build (nuxt: Nuxt) {
  return getBuilder(nuxt).build()
}
