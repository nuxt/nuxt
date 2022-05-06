import { defineComponent } from 'vue'
import type { SetupContext } from 'vue'
import { useHead } from './composables'

type Props = Readonly<Record<string, any>>

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

// <script>
export const Script = defineComponent({
  name: 'Script',
  props: {
    ...globalProps,
    async: Boolean,
    crossorigin: {
      type: [Boolean, String],
      default: undefined
    },
    defer: Boolean,
    integrity: String,
    nomodule: Boolean,
    nonce: String,
    referrerpolicy: String,
    src: String,
    type: String,
    /** @deprecated **/
    charset: String,
    /** @deprecated **/
    language: String
  },
  setup: setupForUseMeta(script => ({
    script: [script]
  }))
})

// <link>
export const Link = defineComponent({
  name: 'Link',
  props: {
    ...globalProps,
    as: String,
    crossorigin: String,
    disabled: Boolean,
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
    referrerpolicy: String,
    rel: String,
    sizes: String,
    title: String,
    type: String,
    /** @deprecated **/
    methods: String,
    /** @deprecated **/
    target: String
  },
  setup: setupForUseMeta(link => ({
    link: [link]
  }))
})

// <base>
export const Base = defineComponent({
  name: 'Base',
  props: {
    ...globalProps,
    href: String,
    target: String
  },
  setup: setupForUseMeta(base => ({
    base
  }))
})

// <title>
export const Title = defineComponent({
  name: 'Title',
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
  name: 'Meta',
  props: {
    ...globalProps,
    charset: String,
    content: String,
    httpEquiv: String,
    name: String
  },
  setup: setupForUseMeta(meta => ({
    meta: [meta]
  }))
})

// <style>
export const Style = defineComponent({
  name: 'Style',
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
    }
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
  name: 'Head',
  setup: (_props, ctx) => () => ctx.slots.default?.()
})

// <html>
export const Html = defineComponent({
  name: 'Html',
  props: {
    ...globalProps,
    manifest: String,
    version: String,
    xmlns: String
  },
  setup: setupForUseMeta(htmlAttrs => ({ htmlAttrs }), true)
})

// <body>
export const Body = defineComponent({
  name: 'Body',
  props: globalProps,
  setup: setupForUseMeta(bodyAttrs => ({ bodyAttrs }), true)
})
