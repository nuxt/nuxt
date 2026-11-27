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
 * During hydration the server HTML is reused as a static vnode, so the slot is skipped
 * on the client and its code is never evaluated there for that render. When the component
 * is rendered after hydration (for example, after client-side navigation) there is no
 * server HTML to reuse, so the slot runs on the client instead of leaving an empty wrapper.
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
        // The slot is tree-shaken from this client render: its code never runs again.
        return elToStaticVNode(el)
      }
      // Rendered after hydration (e.g. client-side navigation): no server HTML to keep,
      // so run the slot on the client rather than rendering an empty wrapper.
      return h('div', { ...attrs, 'data-server-only': '' }, slots.default?.())
    }
  },
})
