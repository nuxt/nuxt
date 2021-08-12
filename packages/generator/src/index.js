import Generator from './generator'
export { default as Generator } from './generator'

export function getGenerator (nuxt, builder) {
  return new Generator(nuxt, builder)
}
