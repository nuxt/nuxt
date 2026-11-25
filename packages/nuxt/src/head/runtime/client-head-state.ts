import type { VueHeadClient } from '@unhead/vue/types'
import type { NuxtApp } from '#app/nuxt'

export interface ClientHeadState {
  paused: boolean
  head?: VueHeadClient
  render?: () => unknown
  /** Whether the root component has set up, which is where the hoisted app component head applies. */
  rootSetup?: boolean
  pushAppComponentHead?: () => void
}

/**
 * Set by `client-head-eager` when a module in the client bundle reads the head
 * through Vue's injection rather than through Nuxt's composables.
 */
export const clientHeadFactory: { create?: (nuxtApp: NuxtApp) => VueHeadClient } = {}

export function getClientHeadState (nuxtApp: NuxtApp): ClientHeadState {
  return nuxtApp['~head'] ||= { paused: true }
}
