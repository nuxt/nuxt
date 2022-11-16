import { defineComponent } from 'vue'
import type { PropType, SetupContext } from 'vue'
import { useHead } from './composables'
import type {
  CrossOrigin,
  FetchPriority,
  HTTPEquiv,
  LinkRelationship,
  Props,
  ReferrerPolicy,
  Target
} from './types'

const removeUndefinedProps = (props: Props) =>
  Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined))

const setupForUseMeta = (metaFactory: (props: Props, ctx: SetupContext) => Record<string, any>, renderChild?: boolean) => (props: Props, ctx: SetupContext) => {
  useHead(() => metaFactory({ ...removeUndefinedProps(props), ...ctx.attrs }, ctx))
  return () => renderChild ? ctx.slots.default?.() : null
}

const globalProps = {
  accesskey: String,
  autocapitalize: String,
  autofocus: {
    type: Boolean,
    default: undefined
  },
  class: String,
  contenteditable: {
    type: Boolean,
    default: undefined
  },
  contextmenu: String,
  dir: String,
  draggable: {
    type: Boolean,
    default: undefined
  },
  enterkeyhint: String,
  exportparts: String,
  hidden: {
    type: Boolean,
    default: undefined
  },
  id: String,
  inputmode: String,
  is: String,
  itemid: String,
  itemprop: String,
  itemref: String,
  itemscope: String,
  itemtype: String,
  lang: String,
  nonce: String,
  part: String,
  slot: String,
  spellcheck: {
    type: Boolean,
    default: undefined
  },
  style: String,
  tabindex: String,
  title: String,
  translate: String
}

// <noscript>
export const NoScript = defineComponent({
  name: 'NoScript',
  inheritAttrs: false,
  props: {
    ...globalProps,
    title: String,
    body: Boolean,
    renderPriority: [String, Number]
  },
  setup: setupForUseMeta((props, { slots }) => {
    const noscript = { ...props }
    const textContent = (slots.default?.() || [])
      .filter(({ children }) => children)
      .map(({ children }) => children)
      .join('')
    if (textContent) {
      noscript.children = textContent
    }
    return {
      noscript: [noscript]
    }
  })
})

// <link>
export const Link = defineComponent({
  // eslint-disable-next-line vue/no-reserved-component-names
  name: 'Link',
  inheritAttrs: false,
  props: {
    ...globalProps,
    as: String,
    crossorigin: String as PropType<CrossOrigin>,
    disabled: Boolean,
    fetchpriority: String as PropType<FetchPriority>,
    href: String,
    hreflang: String,
    imagesizes: String,
    imagesrcset: String,
    integrity: String,
    media: String,
    prefetch: {
      type: Boolean,
      default: undefined
    },
    referrerpolicy: String as PropType<ReferrerPolicy>,
    rel: String as PropType<LinkRelationship>,
    sizes: String,
    title: String,
    type: String,
    /** @deprecated **/
    methods: String,
    /** @deprecated **/
    target: String as PropType<Target>,
    body: Boolean,
    renderPriority: [String, Number]
  },
  setup: setupForUseMeta(link => ({
    link: [link]
  }))
})

// <base>
export const Base = defineComponent({
  // eslint-disable-next-line vue/no-reserved-component-names
  name: 'Base',
  inheritAttrs: false,
  props: {
    ...globalProps,
    href: String,
    target: String as PropType<Target>
  },
  setup: setupForUseMeta(base => ({
    base
  }))
})

// <title>
export const Title = defineComponent({
  // eslint-disable-next-line vue/no-reserved-component-names
  name: 'Title',
  inheritAttrs: false,
  setup: setupForUseMeta((_, { slots }) => {
    const title = slots.default?.()?.[0]?.children || null
    if (process.dev && title && typeof title !== 'string') {
      console.error('<Title> can only take a string in its default slot.')
    }
    return {
      title
    }
  })
})

// <meta>
export const Meta = defineComponent({
  // eslint-disable-next-line vue/no-reserved-component-names
  name: 'Meta',
  inheritAttrs: false,
  props: {
    ...globalProps,
    charset: String,
    content: String,
    httpEquiv: String as PropType<HTTPEquiv>,
    name: String,
    body: Boolean,
    renderPriority: [String, Number]
  },
  setup: setupForUseMeta((props) => {
    const meta = { ...props }
    // fix casing for http-equiv
    if (meta.httpEquiv) {
      meta['http-equiv'] = meta.httpEquiv
      delete meta.httpEquiv
    }
    return {
      meta: [meta]
    }
  })
})

// <style>
export const Style = defineComponent({
  // eslint-disable-next-line vue/no-reserved-component-names
  name: 'Style',
  inheritAttrs: false,
  props: {
    ...globalProps,
    type: String,
    media: String,
    nonce: String,
    title: String,
    /** @deprecated **/
    scoped: {
      type: Boolean,
      default: undefined
    },
    body: Boolean,
    renderPriority: [String, Number]
  },
  setup: setupForUseMeta((props, { slots }) => {
    const style = { ...props }
    const textContent = slots.default?.()?.[0]?.children
    if (textContent) {
      if (process.dev && typeof textContent !== 'string') {
        console.error('<Style> can only take a string in its default slot.')
      }
      style.children = textContent
    }
    return {
      style: [style]
    }
  })
})

// <head>
export const Head = defineComponent({
  // eslint-disable-next-line vue/no-reserved-component-names
  name: 'Head',
  inheritAttrs: false,
  setup: (_props, ctx) => () => ctx.slots.default?.()
})

// <html>
export const Html = defineComponent({
  // eslint-disable-next-line vue/no-reserved-component-names
  name: 'Html',
  inheritAttrs: false,
  props: {
    ...globalProps,
    manifest: String,
    version: String,
    xmlns: String,
    renderPriority: [String, Number]
  },
  setup: setupForUseMeta(htmlAttrs => ({ htmlAttrs }), true)
})

// <body>
export const Body = defineComponent({
  // eslint-disable-next-line vue/no-reserved-component-names
  name: 'Body',
  inheritAttrs: false,
  props: {
    ...globalProps,
    renderPriority: [String, Number]
  },
  setup: setupForUseMeta(bodyAttrs => ({ bodyAttrs }), true)
})
