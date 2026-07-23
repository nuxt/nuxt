import type { Component, defineAsyncComponent } from 'vue'
import { createVNode, defineComponent, onErrorCaptured } from 'vue'

import { createError } from '../composables/error'
import { findReservedRootIslandPropKey } from '../island-props'

// @ts-expect-error virtual file
import { islandComponents } from '#build/components.islands.mjs'

export default defineComponent({
  name: 'IslandRenderer',
  props: {
    context: {
      type: Object as () => { name: string, props?: Record<string, any> },
      required: true,
    },
  },
  async setup (props) {
    const name = props.context.name
    const component = Object.hasOwn(islandComponents, name)
      ? islandComponents[name] as ReturnType<typeof defineAsyncComponent>
      : undefined

    if (!component) {
      throw createError({
        status: 404,
        statusText: `Island component not found: ${props.context.name}`,
      })
    }

    onErrorCaptured((e) => {
      console.log(e)
    })

    // Islands are registered as async components, so the declarations that decide whether a
    // request-supplied prop falls through as an attribute are only visible once loaded. The
    // loader memoises, so awaiting it here does not add a second import. This has to come
    // after every call that relies on the active component instance, since awaiting clears it.
    const loader = (component as { __asyncLoader?: () => Promise<Component> }).__asyncLoader
    const reservedKey = findReservedRootIslandPropKey(props.context.props, loader ? await loader() : component)
    if (reservedKey) {
      // The detail goes to the server console; the response carries a fixed reason so it
      // cannot be used to probe which islands declare which props.
      if (import.meta.dev) {
        console.warn(`Island \`${name}\` was sent a top-level \`${reservedKey}\` prop it does not declare, so the request was rejected. Declare it as a prop on the island, or set \`inheritAttrs: false\`.`)
      }
      throw createError({
        status: 400,
        statusText: 'Invalid island request props',
      })
    }

    return () => createVNode(component || 'span', { ...props.context.props, 'data-island-uid': '' })
  },
})
