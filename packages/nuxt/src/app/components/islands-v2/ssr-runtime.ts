// Under islands v2, compiled SSR templates import their helpers from here (`ssrRuntimeModuleName`).
export * from 'vue/server-renderer'
// A `<slot>` directly inside `<Transition>` compiles to `ssrRenderSlotInner`, which stays Vue's,
// so such a slot of the island's root gets no slot outlet.
export { ssrRenderSlot, ssrRenderTeleport } from './server'
// The islands v-for clamp only rewrites `vue/server-renderer` imports, which this module replaces.
export { ssrRenderList } from '../render-list'
