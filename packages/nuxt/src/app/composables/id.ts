import { getCurrentInstance } from 'vue'
import { useNuxtApp } from '../nuxt'

const ATTR_KEY = 'data-n-ids'

/**
 * Generate a ssr-friendly unique Id that can be passed to accessibility attributes.
 */
export function useId (key: string = 'n'): string {
  const nuxt = useNuxtApp()
  const instance = getCurrentInstance()
  if (!instance) {
    throw new Error('[nuxt] useId() must be called within a component.')
  }
  let id
  if (nuxt.payload.serverRendered && nuxt.isHydrating) {
    instance._nuxtIdIndex = instance._nuxtIdIndex || 0
    const serverIds = instance.vnode.el?.getAttribute?.(ATTR_KEY)?.split?.(',') || []
    if (serverIds.length) {
      id = parseInt(serverIds[instance._nuxtIdIndex], 10) || 0
      instance._nuxtIdIndex++
    } else {
      if (!instance.vnode.el?.getAttribute && (!instance.parent || instance.parent.type.name !== 'ClientOnly')) {
        console.error('[nuxt] useId() needs to be used with a component having on single root element.')
      }
      id = ++nuxt.payload._id
    }
  } else {
    id = ++nuxt.payload._id
    if (import.meta.server) {
      if (instance.attrs[ATTR_KEY]) {
        instance.attrs[ATTR_KEY] = instance.attrs[ATTR_KEY] + ',' + id
      } else {
        instance.attrs[ATTR_KEY] = id
      }
    }
  }

  return key + ':' + id
}
