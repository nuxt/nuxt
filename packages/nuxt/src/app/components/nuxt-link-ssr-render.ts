import type { Component, ComponentInternalInstance, Slots, VNode } from 'vue'
import { getCurrentInstance, h } from 'vue'
import { ssrRenderAttrs, ssrRenderComponent, ssrRenderVNode } from 'vue/server-renderer'
import type { NuxtLinkSsrState } from './nuxt-link'

type SSRBufferItem = string | SSRBuffer | Promise<SSRBuffer>
interface SSRBuffer extends Array<SSRBufferItem> { hasAsync?: boolean }

type SSRSlot = (props: object, push: (item: SSRBufferItem) => void, parent: ComponentInternalInstance, scopeId: string) => unknown

/**
 * Renders a template `<NuxtLink>` straight into the parent's SSR buffer, without a component
 * instance, when the link resolves to a static anchor.
 */
export function ssrRenderNuxtLink (comp: Component & { __ssrLink?: (props: Record<string, unknown>, parent: ComponentInternalInstance) => NuxtLinkSsrState | undefined }, props: Record<string, unknown> | null, slots: Slots | null, parent: ComponentInternalInstance, slotScopeId?: string) {
  const state = props && slots && comp.__ssrLink?.(props, parent)
  if (!state || !slots) {
    return ssrRenderComponent(comp, props, slots, parent, slotScopeId)
  }

  let html = (state.openTag ?? `<a${ssrRenderAttrs(state.attrs())}`) + ssrScopeIds(slotScopeId) + '>'
  let buffer: SSRBuffer | undefined
  const push = (item: SSRBufferItem) => {
    if (buffer) {
      buffer.push(item)
    } else if (typeof item === 'string') {
      html += item
    } else {
      buffer = [html, item]
      buffer.hasAsync = true
    }
  }

  const ret = (slots.default as SSRSlot | undefined)?.(state.link, push, parent, slotScopeId ? ' ' + slotScopeId : '')
  if (ret !== undefined) {
    html = ''
    buffer = undefined
    ssrRenderVNode(push, h('a', state.attrs(), ret as VNode[]), parent, slotScopeId)
    return buffer ?? html
  }

  if (buffer) {
    buffer.push('</a>')
    return buffer
  }
  return html + '</a>'
}

function ssrScopeIds (slotScopeId?: string): string {
  const scopeId = (getCurrentInstance()?.type as { __scopeId?: string } | undefined)?.__scopeId
  let ids = scopeId ? ' ' + scopeId : ''
  if (slotScopeId) {
    for (const id of slotScopeId.trim().split(' ')) {
      if (id && id !== scopeId) { ids += ' ' + id }
    }
  }
  return ids
}
