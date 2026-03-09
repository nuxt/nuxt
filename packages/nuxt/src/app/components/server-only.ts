import { defineComponent, getCurrentInstance, h } from 'vue'
import type { RendererNode, VNode } from 'vue'
import { elToStaticVNode } from './utils'

const SERVER_ONLY_WRAPPER = '<div data-server-only></div>'

/**
 * Renders slot content only on the server. On the client, the server-rendered HTML
 * is preserved as static content and never hydrated—slot logic (e.g. `new Date()`)
 * does not run again after hydration.
 *
 * Use for content that must be fixed at render time: build timestamps, server-only
 * data, etc.
 *
 * @see https://github.com/nuxt/nuxt/issues/27073
 */
export default defineComponent({
  name: 'ServerOnly',
  inheritAttrs: false,
  setup (_, { attrs, slots }) {
    const instance = getCurrentInstance()
    return (): VNode => {
      if (import.meta.server) {
        const vnodes = slots.default?.()
        return h('div', { ...attrs, 'data-server-only': '' }, vnodes)
      }
      // Client: preserve server-rendered HTML as static, never re-run slot
      return elToStaticVNode(instance?.vnode?.el as RendererNode | null, SERVER_ONLY_WRAPPER)
    }
  },
})
