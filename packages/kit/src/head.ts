import type { NuxtAppConfig } from '@nuxt/schema'
import { useNuxt } from './context.ts'
import { defu } from 'defu'

export function setGlobalHead (head: NuxtAppConfig['head']): void {
  const nuxt = useNuxt()
  nuxt.options.app.head = defu(head, nuxt.options.app.head)
}
