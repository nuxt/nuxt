import { ErrorCodes, defineComponent, getCurrentInstance, h, handleError, shallowRef, watch } from 'vue'
import type { Component, FunctionalComponent, PropType, Slots, VNode } from 'vue'
import { importFn as localImportFn } from '#islands-v2-manifest'
import type { IslandComponentMarker } from './shared'
import { type RemoteIsland, htmlToVNodes } from './dom-to-vnode'
import { createRemoteImportFn } from './import-fn'

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
    remote: {
      type: Object as PropType<RemoteIsland>,
      required: false,
      default: undefined,
    },
    /**
     * Server HTML of a component the client mounts rather than hydrates, shown until its chunk loads.
     */
    fallback: {
      type: Object as PropType<VNode>,
      required: false,
      default: undefined,
    },
  },
  setup (props) {
    const instance = getCurrentInstance()

    const loadComponent = async (chunk: string, exportName: string) => {
      try {
        // Read per load: a refetched remote island can list different chunk paths.
        const importFn = props.remote ? createRemoteImportFn(props.remote.source, props.remote.chunks ?? {}) : localImportFn
        return await importFn(chunk, exportName)
      } catch (error) {
        handleError(error, instance, ErrorCodes.ASYNC_COMPONENT_LOADER, false)
        return LOAD_FAILED
      }
    }

    const Loaded = shallowRef<Component>()
    let loadId = 0
    const load = async (chunk: string, exportName: string) => {
      const id = ++loadId
      const component = await loadComponent(chunk, exportName)
      // A mounted component keeps showing its server HTML when its chunk fails to load.
      if (id === loadId && !(component === LOAD_FAILED && props.fallback && !Loaded.value)) { Loaded.value = component }
    }
    const loaded = load(props.data[1], props.data[2] ?? 'default')
    watch([() => props.data[1], () => props.data[2]], ([chunk, exportName]) => load(chunk, exportName ?? 'default'))

    const htmlSlots = new Map<string, VNode[]>()
    const renderHtmlSlot = (html: string): VNode[] => {
      let vnodes = htmlSlots.get(html)
      if (!vnodes) {
        vnodes = htmlToVNodes(html, { nonce: props.nonce, nonces: props.nonces, slots: props.islandSlots, remote: props.remote })
        htmlSlots.set(html, vnodes)
      }
      return vnodes
    }

    const render = () => Loaded.value
      ? h(Loaded.value, props.data[0], Object.fromEntries(
          Object.entries(props.data[3] ?? {}).map(([name, html]) => [name, () => renderHtmlSlot(html)]),
        ))
      : props.fallback
    // Replacing the hydrated fallback mounts the component; otherwise setup suspends and hydrates it.
    return props.fallback ? render : loaded.then(() => render)
  },
})
