import Builder from './builder'
export { default as Builder } from './builder'

export function getBuilder (nuxt) {
  return new Builder(nuxt)
}
