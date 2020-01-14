import Builder from './builder'
export { default as Builder } from './builder'

export function getBuilder (nuxt) {
  return new Builder(nuxt)
}

export function build (nuxt) {
  return getBuilder(nuxt).build()
}
