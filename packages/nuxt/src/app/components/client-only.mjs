import {
  createElementBlock,
  createElementVNode,
  createStaticVNode,
  defineComponent,
  getCurrentInstance,
  h,
  onMounted,
  ref
} from 'vue'

export default defineComponent({
  name: 'ClientOnly',
  inheritAttrs: false,
  // eslint-disable-next-line vue/require-prop-types
  props: ['fallback', 'placeholder', 'placeholderTag', 'fallbackTag'],
  setup (_, { slots, attrs }) {
    const mounted = ref(false)
    onMounted(() => { mounted.value = true })
    return (props) => {
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

export function createClientOnly (component) {
  if (cache.has(component)) {
    return cache.get(component)
  }

  const clone = { ...component }

  if (clone.render) {
    // override the component render (non script setup component)
    clone.render = (ctx, ...args) => {
      if (ctx.mounted$) {
        const res = component.render(ctx, ...args)
        return (res.children === null || typeof res.children === 'string')
          ? createElementVNode(res.type, res.props, res.children, res.patchFlag, res.dynamicProps, res.shapeFlag)
          : h(res)
      } else {
        return process.client ? getStaticVNode(ctx._.vnode) : h('div', ctx.$attrs ?? ctx._.attrs)
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
    const instance = getCurrentInstance()

    const inheritAttrs = instance.inheritAttrs
    // remove exsting directives during hydration
    const directives = extractDirectives(instance)
    // prevent attrs inheritance since a staticVNode is rendered before hydration
    instance.inheritAttrs = false
    const mounted$ = ref(false)

    onMounted(() => {
      instance.inheritAttrs = inheritAttrs
      instance.vnode.dirs = directives
      mounted$.value = true
    })

    return Promise.resolve(component.setup?.(props, ctx) || {})
      .then((setupState) => {
        return typeof setupState !== 'function'
          ? { ...setupState, mounted$ }
          : (...args) => {
              if (mounted$.value) {
                const res = setupState(...args)
                return (res.children === null || typeof res.children === 'string')
                  ? createElementVNode(res.type, res.props, res.children, res.patchFlag, res.dynamicProps, res.shapeFlag)
                  : h(res)
              } else {
                return process.client ? getStaticVNode(args[0]._.vnode) : h('div', ctx.attrs)
              }
            }
      })
  }

  cache.set(component, clone)

  return clone
}

function getStaticVNode (vnode) {
  const fragment = getFragmentHTML(vnode.el)

  if (fragment.length === 0) {
    return null
  }
  return createStaticVNode(fragment.join(''), fragment.length)
}

function getFragmentHTML (element) {
  if (element) {
    if (element.nodeName === '#comment' && element.nodeValue === '[') {
      return getFragmentChildren(element)
    }
    return [element.outerHTML]
  }
  return []
}

function getFragmentChildren (element, blocks = []) {
  if (element && element.nodeName) {
    if (isEndFragment(element)) {
      return blocks
    } else if (!isStartFragment(element)) {
      blocks.push(element.outerHTML)
    }

    getFragmentChildren(element.nextSibling, blocks)
  }
  return blocks
}

function isStartFragment (element) {
  return element.nodeName === '#comment' && element.nodeValue === '['
}

function isEndFragment (element) {
  return element.nodeName === '#comment' && element.nodeValue === ']'
}

function extractDirectives (instance) {
  if (!instance.vnode.dirs) { return null }
  const directives = instance.vnode.dirs
  instance.vnode.dirs = null
  return directives
}
