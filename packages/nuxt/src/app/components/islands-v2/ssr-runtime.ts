// SSR templates import their helpers from here under islands v2, through the `ssrRuntimeModuleName` compiler option.
export * from 'vue/server-renderer'
// `ssrRenderSlotInner` (a slot directly inside `<Transition>`) stays Vue's, so such an island root slot is not marked.
export { ssrRenderSlot, ssrRenderTeleport } from './server'
// The islands v-for clamp rewrites `vue/server-renderer` imports only, which this module replaces.
export { ssrRenderList } from '../render-list'
