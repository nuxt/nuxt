import { dirname } from 'path'
import { loadNuxtConfig } from '@nuxt/kit'
import Nuxt from './nuxt'
export interface LoadNuxtOptions {
}

export async function loadNuxt (opts: LoadNuxtOptions) {
  const options = await loadNuxtConfig(opts)

  // Temp
  options.appDir = dirname(require.resolve('@nuxt/app'))
  options._majorVersion = 3

  const nuxt = new Nuxt(options)
  await nuxt.ready()
  return nuxt
}
