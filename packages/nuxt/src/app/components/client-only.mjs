import { ref, onMounted, defineComponent, createElementBlock, h } from 'vue'

export default defineComponent({
  name: 'ClientOnly',
  // eslint-disable-next-line vue/require-prop-types
  props: ['fallback', 'placeholder', 'placeholderTag', 'fallbackTag'],
  setup (_, { slots }) {
    const mounted = ref(false)
    onMounted(() => { mounted.value = true })
    return (props) => {
      if (mounted.value) { return slots.default?.() }
      const slot = slots.fallback || slots.placeholder
      if (slot) { return slot() }
      const fallbackStr = props.fallback || props.placeholder || ''
      const fallbackTag = props.fallbackTag || props.placeholderTag || 'span'
      return createElementBlock(fallbackTag, null, fallbackStr)
    }
  }
})

export function createClientOnly (component) {
  return defineComponent({
    name: 'ClientOnlyWrapper',
    setup (props, { attrs, slots }) {
      const mounted = ref(false)
      onMounted(() => { mounted.value = true })
      return () => {
        if (mounted.value) {
          return h(component, { props, attrs }, slots)
        }
        return h('div')
      }
    }
  })
}
