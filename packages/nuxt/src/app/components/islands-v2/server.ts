import type { Component, ComponentInternalInstance, VNode } from 'vue'
import {
  createVNode,
  defineComponent,
  getCurrentInstance,
  popScopeId,
  pushScopeId,
  ssrContextKey,
  // @ts-expect-error ssrUtils is not a public API
  ssrUtils,
  toRaw,
} from 'vue'
import {
  ssrRenderComponent,
  ssrRenderSlotInner,
  ssrRenderVNode,
  ssrRenderSlot as vueSsrRenderSlot,
  ssrRenderTeleport as vueSsrRenderTeleport,
} from 'vue/server-renderer'
import { isOn, isPromise } from '@vue/shared'
import { chunkPaths } from '#islands-v2-manifest'
import {
  type IslandComponentMarker,
  type IslandSlotMarker,
  type IslandTeleportMarker,
  type MarkerSet,
  PROTOTYPE_KEYS,
  VNODE_RESERVED_PROPS,
  encodeMarker,
} from './shared'
import type { SSRBuffer, SSRBufferItem } from '../utils'
import type { NuxtSSRContext } from '../../types'

/**
 * What the islands compiler passes in place of a `v-load-client` component and its props.
 */
interface ClientBoundaryProps {
  /**
   * Component to render on the server; the client loads its chunk and hydrates it.
   */
  is: Component | string
  /**
   * Props of that component; the marker keeps only the ones that serialize to JSON.
   */
  props?: Record<string, any> | null
  /**
   * Value of the `v-load-client` binding.
   *
   * @remarks `false` renders the component inline without markers
   */
  enabled?: boolean
  /**
   * Chunk the client loads the component from. Without one, the component renders inline
   * without markers.
   */
  chunk?: string
  /**
   * Export of the chunk that holds the component.
   *
   * @default 'default'
   */
  exportName?: string
  /**
   * Makes the client mount the chunk's component over the server HTML instead of hydrating it.
   * Used when `is` comes from `Foo.server.vue` and the chunk from `Foo.client.vue`.
   */
  mount?: boolean
  /**
   * Also renders the slots the component did not render on the server, so the client gets them.
   * Set by the `.slots` modifier of `v-load-client`.
   */
  allSlots?: boolean
}

/**
 * Options the compiled SSR code passes `ssrRenderClientComponent` after Vue's own arguments.
 */
type ClientRenderOptions = Omit<ClientBoundaryProps, 'is' | 'props'>

type PushFn = (item: SSRBufferItem) => void
type SSRSlot = (
  props: Record<string, unknown>,
  push?: PushFn,
  parent?: ComponentInternalInstance,
  scopeId?: string | null,
) => unknown
type SSRSlots = Record<string, SSRSlot>
/**
 * A compiled slot fallback. The islands compiler gives it a `push` parameter
 * (see `ssr-slot-fallback.ts`), so it can render into a separate buffer.
 */
type SlotFallback = (push: PushFn) => void
type MaybePromise<T> = T | Promise<T>

/**
 * VNodes of the `v-load-client` components rendered with markers. Teleports inside them get no
 * teleport marker, because the client renders those components, teleports included, itself.
 */
const CLIENT_VNODES = new WeakSet<VNode>()
const UNSCANNED_WARNED = new WeakSet<Component>()

/**
 * Render a `v-load-client` component and, during an island render, wrap it in a component marker.
 * Compiled SSR code calls it in place of `ssrRenderComponent`, with `options` after `parent`.
 * Outside an island render it behaves like Vue's `ssrRenderComponent`.
 */
export function ssrRenderClientComponent (
  is: Component | string,
  props: Record<string, any> | null | undefined,
  slots: SSRSlots | null | undefined,
  parent: ComponentInternalInstance,
  { enabled, chunk, exportName = 'default', mount, allSlots }: ClientRenderOptions = {},
  slotScopeId?: string,
): SSRBuffer | Promise<SSRBuffer> {
  if (typeof is === 'string') {
    const buffer: SSRBuffer = []
    ssrRenderVNode(item => buffer.push(item), createVNode(is, props, slots), parent, slotScopeId)
    return buffer
  }

  const islands = enabled === false ? undefined : ssrContextOf(parent)?.islands
  if (islands && chunk === undefined && import.meta.dev) { warnUnscanned(is) }
  if (!islands || chunk === undefined) {
    return ssrRenderComponent(
      is,
      props,
      slots as Parameters<typeof ssrRenderComponent>[2],
      parent,
      slotScopeId,
    ) as SSRBuffer | Promise<SSRBuffer>
  }
  // `chunkPaths` is empty unless the app serves remote islands.
  if (Object.hasOwn(chunkPaths, chunk)) { islands.chunks[chunk] = chunkPaths[chunk]! }
  const markers = islands.markers

  const captured: Record<string, SSRBuffer> = {}
  // Built by hand, unlike in `ssrRenderComponent`, so the vnode can be recorded in `CLIENT_VNODES`.
  const vnode = createVNode(is, props, captureSlots(slots, captured, parent))
  CLIENT_VNODES.add(vnode)
  const buffer: SSRBuffer = []
  ssrRenderVNode(item => buffer.push(item), vnode, parent, slotScopeId)

  return chain(unroll(buffer), html =>
    // Slots the component did not render could hold content it hides, so they are sent only on request.
    chain(allSlots ? captureUnrenderedSlots(slots, captured, vnode.component ?? parent, is) : undefined, unrendered =>
      chain(unrollRecord(captured), (rendered): SSRBuffer => {
        const slotHtml = rendered || unrendered ? { ...unrendered, ...rendered } : undefined
        const tuple: IslandComponentMarker = [markerProps(props), chunk, exportName]
        if (slotHtml || mount) { tuple.push(slotHtml ?? {}) }
        if (mount) { tuple.push(1) }
        return [
          `<!--${markers.component}${encodeMarker(tuple)}-->`,
          // Fragment anchors let the client hydrate this HTML as one fragment and later replace it.
          mount ? `<!--[-->${html}<!--]-->` : html,
          `<!--${markers.componentEnd}-->`,
        ]
      }),
    ),
  )
}

/**
 * Statement form of `ssrRenderClientComponent`, replacing Vue's `ssrRenderVNode` call
 * for dynamic components: `_push` comes first, then the same arguments.
 */
export function ssrRenderClientVNode (
  push: PushFn,
  is: Component | string,
  props: Record<string, any> | null | undefined,
  slots: SSRSlots | null | undefined,
  parent: ComponentInternalInstance,
  options?: ClientRenderOptions,
  slotScopeId?: string,
): void {
  push(ssrRenderClientComponent(is, props, slots, parent, options, slotScopeId))
}

/**
 * Vue's `ssrRenderTeleport` that, during an island render, first writes a teleport marker
 * (see `IslandTeleportMarker`). Compiled SSR code imports it from `ssr-runtime.ts`.
 */
export function ssrRenderTeleport (
  parentPush: PushFn,
  contentRenderFn: (push: PushFn) => void,
  target: string,
  disabled: boolean,
  parentComponent: ComponentInternalInstance,
): void {
  const markers = markersOf(parentComponent)
  // `getCurrentInstance()` is the component whose template holds the teleport, even in slot content.
  if (!markers || insideClientComponent(getCurrentInstance())) {
    vueSsrRenderTeleport(parentPush, contentRenderFn, target, disabled, parentComponent)
    return
  }
  const open = (html?: string): string => {
    const tuple: IslandTeleportMarker = [target, !!disabled]
    if (html !== undefined) { tuple.push(html) }
    return `<!--${markers.teleport}${encodeMarker(tuple)}-->`
  }
  // Disabled content renders inline, so the client reads it from the DOM, not from the marker.
  if (disabled) {
    parentPush(open())
    vueSsrRenderTeleport(parentPush, contentRenderFn, target, disabled, parentComponent)
    return
  }

  // Placeholder for the marker, filled once the content HTML is known, which may be async.
  const marker: SSRBuffer = []
  marker.hasAsync = true
  parentPush(marker)
  const content: SSRBuffer = []
  vueSsrRenderTeleport(
    parentPush,
    push =>
      contentRenderFn((item) => {
        content.push(item)
        push(item)
      }),
    target,
    disabled,
    parentComponent,
  )
  marker.push(chain(unroll(content), (html): SSRBuffer => [open(html)]))
}

/**
 * Vue's `ssrRenderSlot` that writes an empty slot outlet (see `IslandSlotMarker`) for each `<slot>`
 * of the island's root component, so the page can render its own slot content there.
 * Other `<slot>`s render as with Vue.
 */
export function ssrRenderSlot (
  slots: SSRSlots,
  slotName: string,
  slotProps: Record<string, unknown>,
  fallbackRenderFn: SlotFallback | null,
  push: PushFn,
  parentComponent: ComponentInternalInstance,
  slotScopeId?: string,
): void {
  const vueSlots = slots as Parameters<typeof vueSsrRenderSlot>[0]
  const markers = markersOf(parentComponent)
  // A root `<slot>` placed in a child's slot content has the child as parent,
  // so compare against the root's slots object instead.
  if (!markers || toRaw(slots) !== ssrContextOf(parentComponent)?.islands?.root?.component?.slots) {
    vueSsrRenderSlot(vueSlots, slotName, slotProps, fallbackRenderFn && (() => fallbackRenderFn(push)), push, parentComponent, slotScopeId)
    return
  }

  // Placeholder filled once the fallback HTML is known. Being an array, not a string, it also
  // stops Vue from treating a slot that holds only this outlet as empty.
  const marker: SSRBuffer = []
  marker.hasAsync = true
  push(marker)
  const fallback: SSRBuffer = []
  const fallbackPush: PushFn = (item) => {
    fallback.push(item)
  }
  ssrRenderSlotInner(vueSlots, slotName, slotProps, fallbackRenderFn && (() => fallbackRenderFn(fallbackPush)), fallbackPush, parentComponent, slotScopeId)
  marker.push(chain(unroll(fallback), (html): SSRBuffer => {
    const tuple: IslandSlotMarker = [slotName, markerProps(slotProps), slotScopeId || null, html]
    return [`<!--${markers.slot}${encodeMarker(tuple)}--><!--${markers.slotEnd}-->`]
  }))
}

/**
 * Component form of `ssrRenderClientComponent`, used in the vnode branch of compiled slots.
 * Vue takes that branch when a child without an SSR render function renders the slot.
 */
export const IslandClientBoundary = /* @__PURE__ */ defineComponent({
  name: 'IslandClientBoundary',
  props: ['is', 'props', 'enabled', 'chunk', 'exportName', 'mount', 'allSlots'],
  ssrRender (
    _ctx: unknown,
    push: PushFn,
    instance: ComponentInternalInstance,
    attrs: Record<string, unknown> | undefined,
  ) {
    const { is, props, enabled, chunk, exportName, mount, allSlots } = instance.props as unknown as ClientBoundaryProps
    // Every real prop is declared, so `attrs` only holds scope ids: this vnode's own, which belongs
    // on the child's root, and slot scope ids, which Vue applies to the whole subtree.
    const rootScopeId = instance.vnode.scopeId
    const slotScopeIds = attrs
      ? Object.keys(attrs)
          .filter(id => id !== rootScopeId)
          .join(' ')
      : ''
    if (rootScopeId) { pushScopeId(rootScopeId) }
    try {
      push(
        ssrRenderClientComponent(
          is,
          props,
          instance.slots as SSRSlots,
          instance,
          { enabled, chunk, exportName, mount, allSlots },
          slotScopeIds || undefined,
        ),
      )
    } finally {
      if (rootScopeId) { popScopeId() }
    }
  },
})

function ssrContextOf (parent: ComponentInternalInstance): NuxtSSRContext | undefined {
  return parent.appContext.provides[ssrContextKey]
}

function markersOf (parent: ComponentInternalInstance): MarkerSet | undefined {
  return ssrContextOf(parent)?.islands?.markers
}

function insideClientComponent (owner: ComponentInternalInstance | null): boolean {
  for (let current = owner; current; current = current.parent) {
    if (CLIENT_VNODES.has(current.vnode)) { return true }
  }
  return false
}

function warnUnscanned (component: Component): void {
  if (UNSCANNED_WARNED.has(component)) { return }
  UNSCANNED_WARNED.add(component)
  console.warn(`[nuxt] [islands] <${nameOf(component)} v-load-client> has no scanned client chunk, as with a \`<component :is>\` target, so it rendered inline without island markers and stays static on the client.`)
}

function nameOf (component: Component): string {
  return (component as { __name?: string }).__name ?? (component as { name?: string }).name ?? 'anonymous component'
}

function captureUnrenderedSlots (
  slots: SSRSlots | null | undefined,
  rendered: Record<string, SSRBuffer>,
  parent: ComponentInternalInstance,
  component: Component,
): MaybePromise<Record<string, string> | undefined> {
  if (!slots) { return }
  let result: Record<string, string> | undefined
  let pending: Promise<void>[] | undefined
  for (const name of Object.keys(slots)) {
    const slot = slots[name]
    if (name === '_' || name in rendered || typeof slot !== 'function') { continue }
    let failure: unknown
    const skip = (error: unknown): void => {
      if (import.meta.dev) {
        console.warn(`[nuxt] [islands] Slot \`${name}\` of <${nameOf(component)} v-load-client> was not rendered on the server and could not be rendered without slot props, so the client gets no content for it.`, error)
      }
    }
    const settle = (html: string): void => {
      if (failure === undefined) { (result ??= {})[name] = html } else { skip(failure) }
    }
    try {
      const html = renderSlotHtml(slot, errorTrap(parent, (error) => { failure ??= error }))
      if (isPromise(html)) { (pending ??= []).push(html.then(settle, skip)) } else { settle(html) }
    } catch (error) {
      skip(error)
    }
  }
  return pending ? Promise.all(pending).then(() => result) : result
}

function renderSlotHtml (slot: SSRSlot, parent: ComponentInternalInstance): MaybePromise<string> {
  const buffer: SSRBuffer = []
  const result = slot({}, (item) => { buffer.push(item) }, parent, null)
  if (Array.isArray(result)) {
    for (const item of renderVNodesToBuffer(result, parent, null)) { buffer.push(item) }
  }
  return unroll(buffer)
}

function errorTrap (parent: ComponentInternalInstance, onError: (error: unknown) => void): ComponentInternalInstance {
  const trap: ComponentInternalInstance & { ec?: ((error: unknown) => boolean)[] } = Object.create(parent)
  trap.ec = [(error) => {
    onError(error)
    return false
  }]
  return trap
}

function captureSlots (
  slots: SSRSlots | null | undefined,
  captured: Record<string, SSRBuffer>,
  boundary: ComponentInternalInstance,
): SSRSlots | null {
  if (!slots) { return null }
  const names = Object.keys(slots)
  if (names.length === 0) { return null }
  const wrapped: SSRSlots = {}
  for (const name of names) {
    const slot = slots[name]!
    // Rest args keep `length` at 0: in dev, `renderSlot` replaces a slot taking several parameters
    // with an empty one.
    wrapped[name] = (...args: Parameters<SSRSlot>) => {
      const [slotProps, push, parent = boundary, scopeId = null] = args
      // Render functions call slots without `push` and get vnodes back, rendered again for the marker.
      if (!push) {
        const result = slot(slotProps, undefined, parent, scopeId)
        // Recorded even without vnodes, so the slot is not rendered again for the marker.
        if (!(name in captured)) {
          captured[name] = Array.isArray(result) ? renderVNodesToBuffer(result, parent, scopeId) : []
        }
        return result
      }
      const buffer: SSRBuffer = []
      const bufferedPush: PushFn = (item) => {
        buffer.push(item)
      }
      const result = slot(slotProps, bufferedPush, parent, scopeId)
      if (Array.isArray(result)) {
        for (const item of renderVNodesToBuffer(result, parent, scopeId)) { buffer.push(item) }
      }
      if (!(name in captured)) { captured[name] = buffer }
      for (const item of buffer) { push(item) }
    }
  }
  // Compiled slot objects carry `_: 1` so Vue hands them to the child untouched.
  return Object.assign(wrapped, { _: 1 })
}

function renderVNodesToBuffer (
  children: unknown[],
  parent: ComponentInternalInstance,
  scopeId: string | null,
): SSRBuffer {
  // Read inside the call: reading `ssrUtils` at module level would keep this module in client bundles.
  const { normalizeVNode }: { normalizeVNode: (child: unknown) => VNode } = ssrUtils
  const buffer: SSRBuffer = []
  const push: PushFn = (item) => {
    buffer.push(item)
  }
  for (const child of children) {
    ssrRenderVNode(push, normalizeVNode(child), parent, scopeId?.trim() || undefined)
  }
  return buffer
}

/**
 * Props a marker can carry: listeners, functions, reserved VNode props and prototype keys are left out.
 */
function markerProps (
  props: Record<string, any> | null | undefined,
): Record<string, any> | null {
  if (!props) { return null }
  const result: Record<string, any> = {}
  for (const key in props) {
    if (isOn(key) || typeof props[key] === 'function') { continue }
    if (VNODE_RESERVED_PROPS.has(key) || PROTOTYPE_KEYS.has(key)) { continue }
    result[key] = props[key]
  }
  return result
}

/**
 * Join a render buffer, staying synchronous unless an item is a Promise.
 */
function unroll (buffer: SSRBuffer): MaybePromise<string> {
  let html = ''
  for (let i = 0; i < buffer.length; i++) {
    const item = buffer[i]!
    if (typeof item === 'string') {
      html += item
      continue
    }
    const rest = chain(item, unroll)
    if (typeof rest === 'string') {
      html += rest
      continue
    }
    return chain(rest, resolved =>
      chain(unroll(buffer.slice(i + 1)), tail => html + resolved + tail),
    )
  }
  return html
}

function unrollRecord (
  buffers: Record<string, SSRBuffer>,
): MaybePromise<Record<string, string> | undefined> {
  const names = Object.keys(buffers)
  if (names.length === 0) { return undefined }
  const result: Record<string, string> = {}
  let pending: Promise<void>[] | undefined
  for (const name of names) {
    const assigned = chain(unroll(buffers[name]!), (html) => {
      result[name] = html
    })
    if (isPromise(assigned)) { (pending ??= []).push(assigned) }
  }
  return pending ? Promise.all(pending).then(() => result) : result
}

/**
 * Apply `fn` to a value that may be a Promise, staying synchronous when it is not.
 */
function chain<T, R> (value: MaybePromise<T>, fn: (value: T) => MaybePromise<R>): MaybePromise<R> {
  return isPromise(value) ? value.then(fn) : fn(value)
}
