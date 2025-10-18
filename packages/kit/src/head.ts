import type { NuxtAppConfig } from '@nuxt/schema'
import { useNuxt } from './context'
import { defu } from 'defu'

export function addAppHead (head: NuxtAppConfig['head']) {
  const nuxt = useNuxt()
  nuxt.options.app.head = defu(head, nuxt.options.app.head)
}
