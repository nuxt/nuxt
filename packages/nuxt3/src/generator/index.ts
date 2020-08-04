import type { Nuxt } from 'src/core'

import Generator from './generator'
export { default as Generator } from './generator'

export function getGenerator (nuxt: Nuxt) {
  return new Generator(nuxt)
}
