import { defineComponent, getCurrentInstance, h } from 'vue'
import type { RendererNode, VNode } from 'vue'
import { elToStaticVNode } from './utils'

/**
 * Renders its slot on the server and keeps that HTML as a static vnode on the client.
 *
 * This is not a server component. The slot belongs to the parent. When that parent is a
 * universal component, the slot is not serialized into an island request, so a server
 * component would have nothing to render.
 *
 * On client-side navigation there is no server HTML to keep, and the slot is not rendered
 * again. Move content that must be rendered on navigation into a `.server.vue` component.
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
        return h('div', { ...attrs, 'data-server-only': '' }, slots.default?.())
      }
      const el = instance?.vnode?.el as RendererNode | null
      if (el) {
        return elToStaticVNode(el)
      }
      return h('div', { ...attrs, 'data-server-only': '' })
    }
  },
})
