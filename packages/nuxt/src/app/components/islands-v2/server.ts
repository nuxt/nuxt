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
 * Props the SSR transform hands the boundary in place of the `v-load-client` component.
 */
interface ClientBoundaryProps {
  /**
   * Component the island renders on the server and the client reloads.
   */
  is: Component | string
  /**
   * Props of that component; listeners and reserved keys are dropped from the marker.
   */
  props?: Record<string, any> | null
  /**
   * The `v-load-client` binding.
   *
   * @remarks `false` renders the component inline without markers
   */
  enabled?: boolean
  /**
   * Chunk the client loads the component from; without one the component renders inline.
   */
  chunk?: string
  /**
   * Export of the chunk that holds the component.
   *
   * @default 'default'
   */
  exportName?: string
}

/**
 * Options the SSR transform passes `ssrRenderClientComponent` after Vue's own arguments.
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
 * Compiled slot fallback, given the push it writes to by the islands compiler (see `ssr-slot-fallback`).
 */
type SlotFallback = (push: PushFn) => void
type MaybePromise<T> = T | Promise<T>

/**
 * VNodes of marked client components; their own templates never write teleport markers.
 */
const CLIENT_VNODES = new WeakSet<VNode>()
const UNSCANNED_WARNED = new WeakSet<Component>()

/**
 * Render a `v-load-client` component with Vue's SSR renderer and wrap its output in island markers.
 * The SSR transform emits this in place of `ssrRenderComponent` with `options` after `parent`;
 * Vue appends the slot scope id after them. Outside an island render it is Vue's own call.
 */
export function ssrRenderClientComponent (
  is: Component | string,
  props: Record<string, any> | null | undefined,
  slots: SSRSlots | null | undefined,
  parent: ComponentInternalInstance,
  { enabled, chunk, exportName = 'default' }: ClientRenderOptions = {},
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
  // Only filled when the app serves remote islands.
  if (Object.hasOwn(chunkPaths, chunk)) { islands.chunks[chunk] = chunkPaths[chunk]! }
  const markers = islands.markers

  const captured: Record<string, SSRBuffer> = {}
  // Same as `ssrRenderComponent`, but holding the vnode tells its subtree apart.
  const vnode = createVNode(is, props, captureSlots(slots, captured, parent))
  CLIENT_VNODES.add(vnode)
  const buffer: SSRBuffer = []
  ssrRenderVNode(item => buffer.push(item), vnode, parent, slotScopeId)

  return chain(unroll(buffer), html =>
    chain(unrollRecord(captured), (slotHtml): SSRBuffer => {
      const tuple: IslandComponentMarker = [markerProps(props), chunk, exportName]
      if (slotHtml) { tuple.push(slotHtml) }
      return [
        `<!--${markers.component}${encodeMarker(tuple)}-->`,
        html,
        `<!--${markers.componentEnd}-->`,
      ]
    }),
  )
}

/**
 * Statement form of `ssrRenderClientComponent` for dynamic components, at Vue's `ssrRenderVNode`
 * call site: `_push` first, then the same arguments.
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
 * Vue's `ssrRenderTeleport`, writing an `i:t` marker with the target, the disabled flag and the
 * content HTML before Vue's own output. SSR templates import it through `ssr-runtime` in place of
 * Vue's; it is Vue's call outside an island render.
 */
export function ssrRenderTeleport (
  parentPush: PushFn,
  contentRenderFn: (push: PushFn) => void,
  target: string,
  disabled: boolean,
  parentComponent: ComponentInternalInstance,
): void {
  const markers = markersOf(parentComponent)
  // The owner is the instance whose template holds the call, slot content included.
  if (!markers || insideClientComponent(getCurrentInstance())) {
    vueSsrRenderTeleport(parentPush, contentRenderFn, target, disabled, parentComponent)
    return
  }
  const open = (html?: string): string => {
    const tuple: IslandTeleportMarker = [target, !!disabled]
    if (html !== undefined) { tuple.push(html) }
    return `<!--${markers.teleport}${encodeMarker(tuple)}-->`
  }
  // Disabled content renders inline, so the walker reads it from the DOM.
  if (disabled) {
    parentPush(open())
    vueSsrRenderTeleport(parentPush, contentRenderFn, target, disabled, parentComponent)
    return
  }

  // Filled once the content is rendered; flagged async in case the content is.
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
 * Vue's `ssrRenderSlot`, writing an `i:s` marker that carries the fallback HTML (see `IslandSlotMarker`)
 * at the island root's own `<slot>` outlets, so the page can render its slot content there.
 * Other outlets are Vue's call.
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
  // A child's slot content can hold a root outlet, so the root's slots object decides, not the parent.
  if (!markers || toRaw(slots) !== ssrContextOf(parentComponent)?.islands?.root?.component?.slots) {
    vueSsrRenderSlot(vueSlots, slotName, slotProps, fallbackRenderFn && (() => fallbackRenderFn(push)), push, parentComponent, slotScopeId)
    return
  }

  // Filled once the fallback is rendered; flagged async in case it is. An array item, unlike a
  // comment string, also keeps Vue from taking a slot holding only this outlet as empty.
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
 * Component form of `ssrRenderClientComponent` for Vue's vnode slot branch,
 * taken when a non-compiled child renders the slot that holds the component.
 */
export const IslandClientBoundary = /* @__PURE__ */ defineComponent({
  name: 'IslandClientBoundary',
  props: ['is', 'props', 'enabled', 'chunk', 'exportName'],
  ssrRender (
    _ctx: unknown,
    push: PushFn,
    instance: ComponentInternalInstance,
    attrs: Record<string, unknown> | undefined,
  ) {
    const { is, props, enabled, chunk, exportName } = instance.props as unknown as ClientBoundaryProps
    // Every real prop is declared, so Vue's attrs here are scope ids only: this vnode's own,
    // which belongs on the child's root, and slot scope ids, which Vue applies to the whole subtree.
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
          { enabled, chunk, exportName },
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
  const name = (component as { __name?: string }).__name ?? (component as { name?: string }).name ?? 'anonymous component'
  console.warn(`[nuxt] [islands] <${name} v-load-client> has no scanned client chunk, as with a \`<component :is>\` target, so it rendered inline without island markers and stays static on the client.`)
}

/**
 * Wrap each slot so its first render is recorded for the marker while still reaching the child.
 */
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
    // Rest args keep `length` at 0: dev `renderSlot` empties any slot declaring SSR-style params.
    wrapped[name] = (...args: Parameters<SSRSlot>) => {
      const [slotProps, push, parent = boundary, scopeId = null] = args
      // Vnode-style callers (manual render functions) pass no push; the vnodes render twice then.
      if (!push) {
        const result = slot(slotProps, undefined, parent, scopeId)
        if (!(name in captured) && Array.isArray(result)) {
          captured[name] = renderVNodesToBuffer(result, parent, scopeId)
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
  // Read per call: a top-level read of `ssrUtils` would keep this module in client bundles.
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
 * Props a marker carries: listeners, functions, reserved VNode props and prototype keys are dropped.
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
