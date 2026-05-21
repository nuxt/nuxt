import { defineComponent, getCurrentInstance, inject, onUnmounted, provide, reactive } from 'vue'
import type { DefineSetupFnComponent, PropType, SlotsType, VNode, VNodeNormalizedChildren } from 'vue'
import type {
  BodyAttributes,
  HtmlAttributes,
  Noscript,
  Base as UnheadBase,
  Link as UnheadLink,
  Meta as UnheadMeta,
  Style as UnheadStyle,
} from '@unhead/vue/types'
import type {
  CrossOrigin,
  FetchPriority,
  HTTPEquiv,
  LinkRelationship,
  ReferrerPolicy,
  Target,
} from './types'
import { useHead } from '#app/composables/head'

interface HeadComponents {
  base?: UnheadBase | null
  bodyAttrs?: BodyAttributes | null
  htmlAttrs?: HtmlAttributes | null
  link?: (UnheadLink | null)[]
  meta?: (UnheadMeta | null)[]
  noscript?: (Noscript | null)[]
  style?: (UnheadStyle | null)[]
  title?: string | null
}
type HeadComponentCtx = { input: HeadComponents, entry: ReturnType<typeof useHead>, update: () => void }
const HeadComponentCtxSymbol = Symbol('head-component')

const TagPositionProps = {
  /**
   * @deprecated Use tagPosition
   */
  body: { type: Boolean, default: undefined },
  tagPosition: { type: String as PropType<UnheadStyle['tagPosition']> },
}

function normalizeProps<T extends Record<string, any>> (_props: T, key?: string): Partial<T> {
  const props = Object.fromEntries(
    Object.entries(_props).filter(([_, value]) => value !== undefined),
  ) as Partial<T> & { tagPosition?: UnheadStyle['tagPosition'], tagPriority: UnheadStyle['tagPriority'] }
  if (typeof props.body !== 'undefined') {
    props.tagPosition = props.body ? 'bodyClose' : 'head'
  }
  if (typeof props.renderPriority !== 'undefined') {
    props.tagPriority = props.renderPriority
  }
  return {
    ...props,
    key,
  }
}

function useVNodeStringKey () {
  const vnodeKey = getCurrentInstance()?.vnode.key
  return vnodeKey != null && typeof vnodeKey !== 'symbol' ? String(vnodeKey) : undefined
}

function useHeadComponentCtx (): HeadComponentCtx {
  return inject<HeadComponentCtx>(HeadComponentCtxSymbol, createHeadComponentCtx, true)
}

function createHeadComponentCtx (): HeadComponentCtx {
  // avoid creating multiple contexts
  const prev = inject<HeadComponentCtx | null>(HeadComponentCtxSymbol, null)
  if (prev) {
    return prev
  }
  const input = reactive({})
  const entry = useHead(input)
  const ctx: HeadComponentCtx = { input, entry, update: () => entry.patch(input) }
  provide(HeadComponentCtxSymbol, ctx)
  return ctx
}

const globalProps = {
  accesskey: String,
  autocapitalize: String,
  autofocus: {
    type: Boolean,
    default: undefined,
  },
  class: { type: [String, Object, Array], default: undefined },
  contenteditable: {
    type: Boolean,
    default: undefined,
  },
  contextmenu: String,
  dir: String,
  draggable: {
    type: Boolean,
    default: undefined,
  },
  enterkeyhint: String,
  exportparts: String,
  hidden: {
    type: Boolean,
    default: undefined,
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
    default: undefined,
  },
  style: { type: [String, Object, Array], default: undefined },
  tabindex: String,
  title: String,
  translate: String,
  /**
   * @deprecated Use tagPriority
   */
  renderPriority: [String, Number],
  /**
   * Unhead prop to modify the priority of the tag.
   */
  tagPriority: { type: [String, Number] as PropType<UnheadStyle['tagPriority']> },
}

interface GlobalProps {
  accesskey?: string
  autocapitalize?: string
  autofocus?: boolean
  class?: string | Record<string, any> | Array<any>
  contenteditable?: boolean
  contextmenu?: string
  dir?: string
  draggable?: boolean
  enterkeyhint?: string
  exportparts?: string
  hidden?: boolean
  id?: string
  inputmode?: string
  is?: string
  itemid?: string
  itemprop?: string
  itemref?: string
  itemscope?: string
  itemtype?: string
  lang?: string
  nonce?: string
  part?: string
  slot?: string
  spellcheck?: boolean
  style?: string | Record<string, any> | Array<any>
  tabindex?: string
  title?: string
  translate?: string
  /**
   * @deprecated Use tagPriority
   */
  renderPriority?: string | number
  /**
   * Unhead prop to modify the priority of the tag.
   */
  tagPriority?: UnheadStyle['tagPriority']
}

interface TagPositionPropsType {
  /**
   * @deprecated Use tagPosition
   */
  body?: boolean
  tagPosition?: UnheadStyle['tagPosition']
}

type SlotWithDefault = SlotsType<{ default?: () => VNode[] }>

// <noscript>
export const NoScript: DefineSetupFnComponent<GlobalProps & TagPositionPropsType & { title?: string }, {}, SlotWithDefault> = defineComponent({
  name: 'NoScript',
  inheritAttrs: false,
  props: {
    ...globalProps,
    ...TagPositionProps,
    title: String,
  },
  setup (props, { slots }) {
    const { input, update } = useHeadComponentCtx()
    input.noscript ||= []
    const idx: keyof typeof input.noscript = input.noscript.push({}) - 1
    onUnmounted(() => {
      input.noscript![idx] = null
      update()
    })
    const key = useVNodeStringKey()
    return () => {
      const noscript = normalizeProps(props, key) as Noscript
      const slotVnodes = slots.default?.()
      const textContent: VNodeNormalizedChildren[] = []
      if (slotVnodes) {
        for (const vnode of slotVnodes) {
          if (vnode.children) {
            textContent.push(vnode.children)
          }
        }
      }
      if (textContent.length > 0) {
        noscript.innerHTML = textContent.join('')
      }
      input.noscript![idx] = noscript
      update()
      return null
    }
  },
}) as unknown as DefineSetupFnComponent<GlobalProps & TagPositionPropsType & { title?: string }, {}, SlotWithDefault>

interface LinkComponentProps extends GlobalProps, TagPositionPropsType {
  as?: string
  crossorigin?: CrossOrigin
  disabled?: boolean
  fetchpriority?: FetchPriority
  href?: string
  hreflang?: string
  imagesizes?: string
  imagesrcset?: string
  integrity?: string
  media?: string
  prefetch?: boolean
  referrerpolicy?: ReferrerPolicy
  rel?: LinkRelationship
  sizes?: string
  title?: string
  type?: string
  /** @deprecated **/
  methods?: string
  /** @deprecated **/
  target?: Target
}

// <link>
export const Link: DefineSetupFnComponent<LinkComponentProps> = defineComponent({
  name: 'Link',
  inheritAttrs: false,
  props: {
    ...globalProps,
    ...TagPositionProps,
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
      default: undefined,
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
  },
  setup (props) {
    const { input, update } = useHeadComponentCtx()
    input.link ||= []
    const idx: keyof typeof input.link = input.link.push(null) - 1
    const key = useVNodeStringKey()

    onUnmounted(() => {
      input.link![idx] = null
      update()
    })

    return () => {
      input.link![idx] = normalizeProps(props, key) as UnheadLink
      update()
      return null
    }
  },
}) as unknown as DefineSetupFnComponent<LinkComponentProps>

interface BaseComponentProps extends GlobalProps {
  href?: string
  target?: Target
}

// <base>
export const Base: DefineSetupFnComponent<BaseComponentProps> = defineComponent({
  name: 'Base',
  inheritAttrs: false,
  props: {
    ...globalProps,
    href: String,
    target: String as PropType<Target>,
  },
  setup (props) {
    const { input, update } = useHeadComponentCtx()
    const key = useVNodeStringKey()
    onUnmounted(() => {
      input.base = null
      update()
    })
    return () => {
      input.base = normalizeProps(props, key) as UnheadBase
      update()
      return null
    }
  },
}) as unknown as DefineSetupFnComponent<BaseComponentProps>

// <title>
export const Title: DefineSetupFnComponent<{}, {}, SlotWithDefault> = defineComponent({
  name: 'Title',
  inheritAttrs: false,
  setup (_, { slots }) {
    const { input, update } = useHeadComponentCtx()
    onUnmounted(() => {
      input.title = null
      update()
    })
    return () => {
      const defaultSlot = slots.default?.()
      input.title = defaultSlot?.[0]?.children ? String(defaultSlot?.[0]?.children) : undefined
      if (import.meta.dev) {
        if (defaultSlot && (defaultSlot.length > 1 || (defaultSlot[0] && typeof defaultSlot[0].children !== 'string'))) {
          console.error('<Title> can take only one string in its default slot.')
        }
      }
      update()
      return null
    }
  },
}) as unknown as DefineSetupFnComponent<{}, {}, SlotWithDefault>

interface MetaComponentProps extends GlobalProps {
  charset?: string
  content?: string
  httpEquiv?: HTTPEquiv
  name?: string
  property?: string
}

// <meta>
export const Meta: DefineSetupFnComponent<MetaComponentProps> = defineComponent({
  name: 'Meta',
  inheritAttrs: false,
  props: {
    ...globalProps,
    charset: String,
    content: String,
    httpEquiv: String as PropType<HTTPEquiv>,
    name: String,
    property: String,
  },
  setup (props) {
    const { input, update } = useHeadComponentCtx()
    const key = useVNodeStringKey()
    input.meta ||= []
    const idx: keyof typeof input.meta = input.meta.push(null) - 1
    onUnmounted(() => {
      input.meta![idx] = null
      update()
    })
    return () => {
      const meta = { 'http-equiv': props.httpEquiv, ...normalizeProps(props, key) } as UnheadMeta
      // fix casing for http-equiv
      if ('httpEquiv' in meta) {
        delete meta.httpEquiv
      }
      input.meta![idx] = meta
      update()
      return null
    }
  },
}) as unknown as DefineSetupFnComponent<MetaComponentProps>

interface StyleComponentProps extends GlobalProps, TagPositionPropsType {
  type?: string
  media?: string
  nonce?: string
  title?: string
  /** @deprecated **/
  scoped?: boolean
}

// <style>
export const Style: DefineSetupFnComponent<StyleComponentProps, {}, SlotWithDefault> = defineComponent({
  name: 'Style',
  inheritAttrs: false,
  props: {
    ...globalProps,
    ...TagPositionProps,
    type: String,
    media: String,
    nonce: String,
    title: String,
    /** @deprecated **/
    scoped: {
      type: Boolean,
      default: undefined,
    },
  },
  setup (props, { slots }) {
    const { input, update } = useHeadComponentCtx()
    const key = useVNodeStringKey()
    input.style ||= []
    const idx: keyof typeof input.style = input.style.push({}) - 1
    onUnmounted(() => {
      input.style![idx] = null
      update()
    })
    return () => {
      const style = normalizeProps(props, key) as UnheadStyle
      const textContent = slots.default?.()?.[0]?.children
      if (textContent) {
        if (import.meta.dev && typeof textContent !== 'string') {
          console.error('<Style> can only take a string in its default slot.')
        }
        input.style![idx] = style
        style.textContent = textContent as string
      }
      update()
      return null
    }
  },
}) as unknown as DefineSetupFnComponent<StyleComponentProps, {}, SlotWithDefault>

// <head>
export const Head: DefineSetupFnComponent<{}, {}, SlotWithDefault> = defineComponent({
  name: 'Head',
  inheritAttrs: false,
  setup: (_props, ctx) => {
    createHeadComponentCtx()
    return () => ctx.slots.default?.()
  },
}) as unknown as DefineSetupFnComponent<{}, {}, SlotWithDefault>

interface HtmlComponentProps extends GlobalProps {
  manifest?: string
  version?: string
  xmlns?: string
}

// <html>
export const Html: DefineSetupFnComponent<HtmlComponentProps, {}, SlotWithDefault> = defineComponent({
  name: 'Html',
  inheritAttrs: false,
  props: {
    ...globalProps,
    manifest: String,
    version: String,
    xmlns: String,
  },
  setup (_props, ctx) {
    const { input, update } = useHeadComponentCtx()
    onUnmounted(() => {
      input.htmlAttrs = null
      update()
    })
    return () => {
      input.htmlAttrs = { ..._props, ...ctx.attrs } as HtmlAttributes
      update()
      return ctx.slots.default?.()
    }
  },
}) as unknown as DefineSetupFnComponent<HtmlComponentProps, {}, SlotWithDefault>

// <body>
export const Body: DefineSetupFnComponent<GlobalProps, {}, SlotWithDefault> = defineComponent({
  name: 'Body',
  inheritAttrs: false,
  props: globalProps,
  setup (_props, ctx) {
    const { input, update } = useHeadComponentCtx()
    onUnmounted(() => {
      input.bodyAttrs = null
      update()
    })
    return () => {
      input.bodyAttrs = { ..._props, ...ctx.attrs } as BodyAttributes
      update()
      return ctx.slots.default?.()
    }
  },
}) as unknown as DefineSetupFnComponent<GlobalProps, {}, SlotWithDefault>
