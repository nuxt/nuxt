import { defineComponent, getCurrentInstance, onErrorCaptured, ref } from 'vue'
import { ssrRenderAttrs, ssrRenderSlot, ssrRenderVNode } from 'vue/server-renderer'
import { useState } from '../composables/state'
import { createBuffer } from './utils'

const NuxtClientFallbackServer = defineComponent({
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
  emits: {
    'ssr-error' (_error: unknown) {
      return true
    }
  },
  setup (props, ctx) {
    const vm = getCurrentInstance()
    const ssrFailed = ref(false)

    onErrorCaptured((err) => {
      useState(`${props.uid}`, () => true)
      ssrFailed.value = true
      ctx.emit('ssr-error', err)
      return false
    })

    try {
      const defaultSlot = ctx.slots.default?.()
      const ssrVNodes = createBuffer()

      for (let i = 0; i < (defaultSlot?.length || 0); i++) {
        ssrRenderVNode(ssrVNodes.push, defaultSlot![i], vm!)
      }

      return { ssrFailed, ssrVNodes }
    } catch (ssrError) {
      // catch in dev
      useState(`${props.uid}`, () => true)
      ctx.emit('ssr-error', ssrError)
      return { ssrFailed: true, ssrVNodes: [] }
    }
  },
  ssrRender (ctx: any, push: any, parent: any) {
    if (ctx.ssrFailed) {
      const { fallback, placeholder } = ctx.$slots
      if (fallback || placeholder) {
        ssrRenderSlot(ctx.$slots, fallback ? 'fallback' : 'placeholder', {}, null, push, parent)
      } else {
        const content = ctx.placeholder || ctx.fallback
        const tag = ctx.placeholderTag || ctx.fallbackTag
        push(`<${tag}${ssrRenderAttrs(ctx.$attrs)}>${content}</${tag}>`)
      }
    } else {
      // push Fragment markup
      push('<!--[-->')
      push(ctx.ssrVNodes.getBuffer())
      push('<!--]-->')
    }
  }
})

export default NuxtClientFallbackServer
