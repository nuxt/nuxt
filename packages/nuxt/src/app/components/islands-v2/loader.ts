import { ErrorCodes, defineComponent, getCurrentInstance, h, handleError, shallowRef, watch } from 'vue'
import type { FunctionalComponent, PropType, Slots, VNode } from 'vue'
import { importFn } from '#islands-v2-manifest'
import type { IslandComponentMarker } from './shared'
import { htmlToVNodes } from './dom-to-vnode'

const LOAD_FAILED: FunctionalComponent = () => null

export default /* @__PURE__ */ defineComponent({
  name: 'NuxtIslandComponentLoader',
  props: {
    data: {
      type: Array as unknown as PropType<IslandComponentMarker>,
      required: true,
    },
    nonce: {
      type: String,
      required: true,
    },
    nonces: {
      type: Array as PropType<readonly string[]>,
      required: false,
      default: undefined,
    },
    islandSlots: {
      type: Object as PropType<Slots>,
      required: false,
      default: undefined,
    },
  },
  async setup (props) {
    const instance = getCurrentInstance()

    const loadComponent = async (chunk: string, exportName: string) => {
      try {
        return await importFn(chunk, exportName)
      } catch (error) {
        handleError(error, instance, ErrorCodes.ASYNC_COMPONENT_LOADER, false)
        return LOAD_FAILED
      }
    }

    const Loaded = shallowRef(await loadComponent(props.data[1], props.data[2] ?? 'default'))

    let loadId = 0
    watch([() => props.data[1], () => props.data[2]], async ([chunk, exportName]) => {
      const id = ++loadId
      const component = await loadComponent(chunk, exportName ?? 'default')
      if (id === loadId) { Loaded.value = component }
    })

    const htmlSlots = new Map<string, VNode[]>()
    const renderHtmlSlot = (html: string): VNode[] => {
      let vnodes = htmlSlots.get(html)
      if (!vnodes) {
        vnodes = htmlToVNodes(html, { nonce: props.nonce, nonces: props.nonces, slots: props.islandSlots })
        htmlSlots.set(html, vnodes)
      }
      return vnodes
    }

    return () => h(Loaded.value, props.data[0], Object.fromEntries(
      Object.entries(props.data[3] ?? {}).map(([name, html]) => [name, () => renderHtmlSlot(html)]),
    ))
  },
})
