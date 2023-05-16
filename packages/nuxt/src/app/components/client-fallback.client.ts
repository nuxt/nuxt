import { createElementBlock, defineComponent, onMounted, ref } from 'vue'
import { useState } from '../composables/state'

export default defineComponent({
  name: 'NuxtClientFallback',
  inheritAttrs: false,
  props: {
    uid: {
      type: String
    },
    fallbackTag: {
      type: String,
      default: () => 'div'
    },
    fallback: {
      type: String,
      default: () => ''
    },
    placeholder: {
      type: String
    },
    placeholderTag: {
      type: String
    },
    keepFallback: {
      type: Boolean,
      default: () => false
    }
  },
  emits: ['ssr-error'],
  setup (props, ctx) {
    const mounted = ref(false)
    const ssrFailed = useState(`${props.uid}`)

    if (ssrFailed.value) {
      onMounted(() => { mounted.value = true })
    }

    return () => {
      if (ssrFailed.value) {
        if (!mounted.value || props.keepFallback) {
          const slot = ctx.slots.placeholder || ctx.slots.fallback
          if (slot) { return slot() }
          const fallbackStr = props.placeholder || props.fallback
          const fallbackTag = props.placeholderTag || props.fallbackTag
          return createElementBlock(fallbackTag, null, fallbackStr)
        }
      }
      return ctx.slots.default?.()
    }
  }
})
