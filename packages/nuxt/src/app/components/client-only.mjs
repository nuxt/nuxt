import { ref, onMounted, defineComponent, createElementBlock, h, Fragment } from 'vue'

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

const cache = new WeakMap()

export function createClientOnly (component) {
  if (cache.has(component)) {
    return cache.get(component)
  }

  const clone = { ...component }

  if (clone.render) {
    // override the component render (non script setup component)
    clone.render = (ctx, ...args) => {
      return ctx.mounted$
        ? h(Fragment, ctx.$attrs ?? ctx._.attrs, component.render(ctx, ...args))
        : h('div', ctx.$attrs ?? ctx._.attrs)
    }
  } else if (clone.template) {
    // handle runtime-compiler template
    clone.template = `
      <template v-if="mounted$">${component.template}</template>
      <template v-else><div></div></template>
    `
  }

  clone.setup = (props, ctx) => {
    const mounted$ = ref(false)
    onMounted(() => { mounted$.value = true })

    return Promise.resolve(component.setup?.(props, ctx) || {})
      .then((setupState) => {
        return typeof setupState !== 'function'
          ? { ...setupState, mounted$ }
          : (...args) => {
              return mounted$.value
                // use Fragment to avoid oldChildren is null issue
                ? h(Fragment, ctx.attrs, setupState(...args))
                : h('div', ctx.attrs)
            }
      })
  }

  cache.set(component, clone)

  return clone
}
