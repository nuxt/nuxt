import { defineComponent, unref, nextTick, onMounted, Ref, Transition, VNode } from 'vue'
import { _wrapIf } from './utils'
import { useRoute } from '#app'
// @ts-ignore
import layouts from '#build/layouts'
// @ts-ignore
import { appLayoutTransition as defaultLayoutTransition } from '#build/nuxt.config.mjs'

export default defineComponent({
  props: {
    name: {
      type: [String, Boolean, Object] as unknown as () => string | false | Ref<string | false>,
      default: null
    }
  },
  setup (props, context) {
    const route = useRoute()

    let vnode: VNode
    let _layout: string | false
    if (process.dev && process.client) {
      onMounted(() => {
        nextTick(() => {
          if (_layout && _layout in layouts && ['#comment', '#text'].includes(vnode?.el?.nodeName)) {
            console.warn(`[nuxt] \`${_layout}\` layout does not have a single root node and will cause errors when navigating between routes.`)
          }
        })
      })
    }

    return () => {
      const layout = unref(props.name) ?? route.meta.layout as string ?? 'default'

      const hasLayout = layout && layout in layouts
      if (process.dev && layout && !hasLayout && layout !== 'default') {
        console.warn(`Invalid layout \`${layout}\` selected.`)
      }

      const transitionProps = route.meta.layoutTransition ?? defaultLayoutTransition

      // We avoid rendering layout transition if there is no layout to render
      return _wrapIf(Transition, hasLayout && transitionProps, {
        default: () => {
          if (process.dev && process.client && transitionProps) {
            _layout = layout
            vnode = _wrapIf(layouts[layout], hasLayout, context.slots).default()
            return vnode
          }

          return _wrapIf(layouts[layout], hasLayout, context.slots).default()
        }
      }).default()
    }
  }
})
