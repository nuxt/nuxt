import { Builder } from '@nuxt/builder'

import Generator from './generator'
export { default as Generator } from './generator'

export function getGenerator (nuxt) {
  const builder = new Builder(nuxt)
  return new Generator(nuxt, builder)
}
