import { h } from 'vue'
import type { Component } from 'vue'

const Fragment = {
  setup (_props, { slots }) {
    return () => slots.default()
  }
}

/**
 * Internal utility
 *
 * @private
 */
export const _wrapIf = (component: Component, props: any, slots: any) => {
  return { default: () => props ? h(component, props === true ? {} : props, slots) : h(Fragment, {}, slots) }
}
