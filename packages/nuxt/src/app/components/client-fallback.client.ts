import { Fragment, createElementBlock, defineComponent, h, onMounted, shallowRef, useId } from 'vue'
import type { DefineSetupFnComponent, SlotsType, VNode } from 'vue'
import { useState } from '../composables/state'

const VALID_TAG_RE = /^[a-z][a-z0-9-]*$/i
function sanitizeTag (tag: string, fallback: string): string {
  return VALID_TAG_RE.test(tag) ? tag : fallback
}

interface NuxtClientFallbackProps {
  fallbackTag?: string
  fallback?: string
  placeholder?: string
  placeholderTag?: string
  keepFallback?: boolean
}

type NuxtClientFallbackEmits = {
  'ssr-error': (error: unknown) => void
}

type NuxtClientFallbackSlots = SlotsType<{
  default?: () => VNode[]
  fallback?: () => VNode[]
  placeholder?: () => VNode[]
}>

const NuxtClientFallbackClient = defineComponent({
  name: 'NuxtClientFallback',
  inheritAttrs: false,
  props: {
    fallbackTag: {
      type: String,
      default: () => 'div',
    },
    fallback: {
      type: String,
      default: () => '',
    },
    placeholder: {
      type: String,
    },
    placeholderTag: {
      type: String,
    },
    keepFallback: {
      type: Boolean,
      default: () => false,
    },
  },
  emits: ['ssr-error'],
  setup (props, ctx) {
    const mounted = shallowRef(false)
    const ssrFailed = useState(useId())

    if (ssrFailed.value) {
      onMounted(() => { mounted.value = true })
    }

    return () => {
      if (ssrFailed.value) {
        if (!mounted.value || props.keepFallback) {
          const slot = ctx.slots.placeholder || ctx.slots.fallback
          if (slot) { return h(Fragment, null, slot()) }
          const fallbackStr = props.placeholder || props.fallback
          const fallbackTag = sanitizeTag(props.placeholderTag || props.fallbackTag, 'div')
          return createElementBlock(fallbackTag, null, fallbackStr)
        }
      }
      return h(Fragment, null, ctx.slots.default?.())
    }
  },
}) as unknown as DefineSetupFnComponent<NuxtClientFallbackProps, NuxtClientFallbackEmits, NuxtClientFallbackSlots>

export default NuxtClientFallbackClient
