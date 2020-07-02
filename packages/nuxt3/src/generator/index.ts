import Generator from './generator'
export { default as Generator } from './generator'

export function getGenerator (nuxt) {
  return new Generator(nuxt)
}
