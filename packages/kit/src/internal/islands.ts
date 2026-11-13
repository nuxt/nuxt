import type { NuxtOptions } from '@nuxt/schema'

/**
 * Whether `experimental.componentIslands` selects islands v2, as `'v2'` or `{ version: 'v2' }`.
 */
export function isIslandsV2 (componentIslands: NuxtOptions['experimental']['componentIslands']): boolean {
  return componentIslands === 'v2' || (typeof componentIslands === 'object' && componentIslands.version === 'v2')
}
