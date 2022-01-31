import { Component, KeepAlive, h } from 'vue'

const Fragment = {
  setup (_props, { slots }) {
    return () => slots.default()
  }
}

export const wrapIf = (component: Component, props: any, slots: any) => {
  return { default: () => props ? h(component, props === true ? {} : props, slots) : h(Fragment, {}, slots) }
}

export const wrapInKeepAlive = (props: any, children: any) => {
  return { default: () => process.client && props ? h(KeepAlive, props === true ? {} : props, children) : children }
}
