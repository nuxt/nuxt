import { createElementBlock, defineComponent } from 'vue'

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
      if (mounted.value) { return ctx.slots.default?.() }
      if (ssrFailed.value) {
        const slot = ctx.slots.placeholder || ctx.slots.fallback
        if (slot) { return slot() }
        const fallbackStr = props.placeholder || props.fallback
        const fallbackTag = props.placeholderTag || props.fallbackTag
        return createElementBlock(fallbackTag, null, fallbackStr)
      }
      return ctx.slots.default?.()
    }
  }
})
