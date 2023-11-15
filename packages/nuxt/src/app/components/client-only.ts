import { createElementBlock, createElementVNode, createStaticVNode, defineComponent, getCurrentInstance, h, onMounted, ref } from 'vue'
import type { ComponentInternalInstance, ComponentOptions } from 'vue'
import { getFragmentHTML } from './utils'

export default defineComponent({
  name: 'ClientOnly',
  inheritAttrs: false,
  // eslint-disable-next-line vue/require-prop-types
  props: ['fallback', 'placeholder', 'placeholderTag', 'fallbackTag'],
  setup (_, { slots, attrs }) {
    const mounted = ref(false)
    onMounted(() => { mounted.value = true })
    return (props: any) => {
      if (mounted.value) { return slots.default?.() }
      const slot = slots.fallback || slots.placeholder
      if (slot) { return slot() }
      const fallbackStr = props.fallback || props.placeholder || ''
      const fallbackTag = props.fallbackTag || props.placeholderTag || 'span'
      return createElementBlock(fallbackTag, attrs, fallbackStr)
    }
  }
})

const cache = new WeakMap()

/*! @__NO_SIDE_EFFECTS__ */
export function createClientOnly<T extends ComponentOptions> (component: T) {
  if (cache.has(component)) {
    return cache.get(component)
  }

  const clone = { ...component }

  if (clone.render) {
    // override the component render (non script setup component)
    clone.render = (ctx: any, ...args: any[]) => {
      if (ctx.mounted$) {
        const res = component.render?.bind(ctx)(ctx, ...args)
        return (res.children === null || typeof res.children === 'string')
          ? createElementVNode(res.type, res.props, res.children, res.patchFlag, res.dynamicProps, res.shapeFlag)
          : h(res)
      } else {
        const fragment = getFragmentHTML(ctx._.vnode.el ?? null) ?? ['<div></div>']
        return process.client ? createStaticVNode(fragment.join(''), fragment.length) : h('div', ctx.$attrs ?? ctx._.attrs)
      }
    }
  } else if (clone.template) {
    // handle runtime-compiler template
    clone.template = `
      <template v-if="mounted$">${component.template}</template>
      <template v-else><div></div></template>
    `
  }

  clone.setup = (props, ctx) => {
    const instance = getCurrentInstance()!

    const attrs = instance.attrs
    // remove existing directives during hydration
    const directives = extractDirectives(instance)
    // prevent attrs inheritance since a staticVNode is rendered before hydration
    instance.attrs = {}
    const mounted$ = ref(false)

    onMounted(() => {
      instance.attrs = attrs
      instance.vnode.dirs = directives
      mounted$.value = true
    })

    return Promise.resolve(component.setup?.(props, ctx) || {})
      .then((setupState) => {
        return typeof setupState !== 'function'
          ? { ...setupState, mounted$ }
          : (...args: any[]) => {
              if (mounted$.value) {
                const res = setupState(...args)
                return (res.children === null || typeof res.children === 'string')
                  ? createElementVNode(res.type, res.props, res.children, res.patchFlag, res.dynamicProps, res.shapeFlag)
                  : h(res)
              } else {
                const fragment = getFragmentHTML(instance?.vnode.el ?? null) ?? ['<div></div>']
                return process.client ? createStaticVNode(fragment.join(''), fragment.length) : h('div', ctx.attrs)
              }
            }
      })
  }

  cache.set(component, clone)

  return clone
}

function extractDirectives (instance: ComponentInternalInstance | null) {
  if (!instance || !instance.vnode.dirs) { return null }
  const directives = instance.vnode.dirs
  instance.vnode.dirs = null
  return directives
}
