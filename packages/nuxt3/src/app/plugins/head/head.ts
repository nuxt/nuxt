import { defineComponent } from '@vue/runtime-core'
import { useHead, HeadObject } from '@vueuse/head'

type MappedProps<T extends Record<string, any>> = {
  [P in keyof T]: { type: () => T[P] }
}

const props: MappedProps<HeadObject> = {
  base: { type: Object },
  bodyAttrs: { type: Object },
  htmlAttrs: { type: Object },
  link: { type: Array },
  meta: { type: Array },
  script: { type: Array },
  style: { type: Array },
  title: { type: String }
}

export const Head = defineComponent({
  props,
  setup (props, { slots }) {
    useHead(() => props)

    return () => slots.default?.()
  }
})

const createHeadComponent = (prop: keyof typeof props, isArray = false) =>
  defineComponent({
    setup (_props, { attrs, slots }) {
      useHead(() => ({
        [prop]: isArray ? [attrs] : attrs
      }))

      return () => slots.default?.()
    }
  })

const createHeadComponentFromSlot = (prop: keyof typeof props) =>
  defineComponent({
    setup (_props, { slots }) {
      useHead(() => ({
        [prop]: slots.default?.()[0]?.children
      }))

      return () => null
    }
  })

export const Html = createHeadComponent('htmlAttrs')
export const Body = createHeadComponent('bodyAttrs')
export const Title = createHeadComponentFromSlot('title')
export const Meta = createHeadComponent('meta', true)
export const Link = createHeadComponent('link', true)
export const Script = createHeadComponent('script', true)
export const Style = createHeadComponent('style', true)
