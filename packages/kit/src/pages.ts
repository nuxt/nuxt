import type { NuxtHooks } from '@nuxt/schema'
import { useNuxt } from './context'
import { isNuxt2 } from './compatibility'

export function extendPages (cb: NuxtHooks['pages:extend']) {
  const nuxt = useNuxt()
  if (isNuxt2(nuxt)) {
    // @ts-expect-error
    nuxt.hook('build:extendRoutes', cb)
  } else {
    nuxt.hook('pages:extend', cb)
  }
}
