import { getCurrentInstance, inject } from 'vue'
import { useNuxtApp } from '../nuxt'
import { clientOnlySymbol } from '#app/components/client-only'

const ATTR_KEY = 'data-n-ids'

/**
 * Generate an SSR-friendly unique identifier that can be passed to accessibility attributes.
 */
export function useId (): string
export function useId (key?: string): string {
  if (typeof key !== 'string') {
    throw new TypeError('[nuxt] [useId] key must be a string.')
  }
  // TODO: implement in composable-keys
  key = key.slice(1)
  const nuxtApp = useNuxtApp()
  const instance = getCurrentInstance()

  if (!instance) {
    // TODO: support auto-incrementing ID for plugins if there is need?
    throw new TypeError('[nuxt] `useId` must be called within a component.')
  }

  nuxtApp._id ||= 0
  instance._nuxtIdIndex ||= {}
  instance._nuxtIdIndex[key] ||= 0

  const instanceIndex = key + ':' + instance._nuxtIdIndex[key]++

  if (import.meta.server) {
    const ids = JSON.parse(instance.attrs[ATTR_KEY] as string | undefined || '{}')
    ids[instanceIndex] = key + ':' + nuxtApp._id++
    instance.attrs[ATTR_KEY] = JSON.stringify(ids)
    return ids[instanceIndex]
  }

  if (nuxtApp.payload.serverRendered && nuxtApp.isHydrating && !inject(clientOnlySymbol, false)) {
    // Access data attribute from sibling if root is a comment node and sibling is an element
    const el = instance.vnode.el?.nodeType === 8 && instance.vnode.el?.nextElementSibling?.getAttribute
      ? instance.vnode.el?.nextElementSibling
      : instance.vnode.el

    const ids = JSON.parse(el?.getAttribute?.(ATTR_KEY) || '{}')
    if (ids[instanceIndex]) {
      return ids[instanceIndex]
    }
  }

  // pure client-side ids, avoiding potential collision with server-side ids
  return key + '_' + nuxtApp._id++
}
