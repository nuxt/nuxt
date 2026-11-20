import type { Slots, VNode } from 'vue'
import { randomUUID } from 'uncrypto'

/**
 * Data of a component marker, the comment pair written around each `v-load-client` component:
 * `<!--i:c:NONCE[props,"/components/Counter.vue","default"]-->…<!--/i:c:NONCE-->`. The client loads
 * that chunk export and hydrates the HTML in between with it, passing `slots` as its slot HTML.
 *
 * @remarks `mount: 1`: a `.server.vue` half rendered the HTML, so the client mounts the `.client.vue` half
 */
export type IslandComponentMarker = [
  props: Record<string, any> | null,
  chunk: string,
  exportName?: string,
  slots?: Record<string, string>,
  mount?: 1,
]

/**
 * Data of a teleport marker, written right before Vue's teleport anchors:
 * `<!--i:t:NONCE["#modal",false,"<p>Hi</p>"]--><!--teleport start-->…<!--teleport end-->`.
 * An enabled teleport carries its content HTML, as that HTML was rendered into the target.
 */
export type IslandTeleportMarker = [to: string, disabled: boolean, html?: string]

/**
 * Data of a slot marker, written where the island's root component renders one of its `<slot>`s:
 * `<!--i:s:NONCE["default",props,"data-v-123",fallbackHtml]--><!--/i:s:NONCE-->`. The empty region
 * between the comments is a slot outlet: the page renders its slot content there, or the fallback.
 */
export type IslandSlotMarker = [
  name: string,
  props: Record<string, any> | null,
  slotScopeId: string | null,
  fallback: string,
]

/**
 * Nonces the client accepts in an island's markers: the island's own,
 * then those of the nested islands rendered inside it.
 */
export interface MarkerNonces {
  nonce: string
  nonces?: string[]
}

/**
 * Marker prefixes of one render, such as `i:c:NONCE`. The nonce is a random string each render
 * creates, and a comment only counts as a marker when its prefix holds a nonce the client accepts.
 */
export interface MarkerSet {
  nonce: string
  component: string
  componentEnd: string
  teleport: string
  slot: string
  slotEnd: string
}

/**
 * State of one islands v2 render
 */
export interface IslandRenderState {
  /**
   * Marker prefixes this render writes.
   */
  markers: MarkerSet
  /**
   * Nonces of the nested islands whose HTML this render includes, sent to the client with its own.
   */
  nested: Set<string>
  /**
   * Client path of each chunk the `v-load-client` components of this render load, by chunk ref,
   * so a remote host can import them.
   */
  chunks: Record<string, string>
  /**
   * VNode of the island component itself; only its own `<slot>`s get slot markers.
   */
  root?: VNode
}

export const MARKER_COMPONENT = 'i:c'
export const MARKER_COMPONENT_END = '/i:c'
export const MARKER_TELEPORT = 'i:t'
export const MARKER_SLOT = 'i:s'
export const MARKER_SLOT_END = '/i:s'
/**
 * Keys that could reach `Object.prototype` when a parsed object is copied; markers must not carry them.
 */
export const PROTOTYPE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype'])
/**
 * Props Vue reserves on a VNode
 */
export const VNODE_RESERVED_PROPS: ReadonlySet<string> = new Set(['key', 'ref', 'ref_for', 'ref_key'])
/**
 * Shape of a Vue scope id attribute. An island's `scopeId` prop and a slot marker's scope id
 * must match it, as both are written into the page as attributes.
 */
export const VUE_SCOPE_ID_RE = /^data-v-[\w-]+$/

const MARKER_NONCE_MIN_LENGTH = 16
const MARKER_NONCE_RE = /^[A-Z0-9]+$/i
// A root-relative path, not protocol-relative (`//host`), without `\`, a query or a fragment.
const CHUNK_PATH_RE = /^\/(?!\/)[\w\-.~@:+%/]*$/
const CHUNK_PATH_DOT_SEGMENT_RE = /(?:^|\/)\.{1,2}(?:\/|$)/
const ENCODED_SEPARATOR_RE = /%(?:2e|2f|5c)/i
// A marker prefix and its nonce, in a comment or inside the HTML that marker data carries.
const MARKER_NONCE_TOKEN_RE = /(i:[cst]:)([a-z0-9]+)/gi

/**
 * Whether a value is a valid marker nonce: a string of 16 or more alphanumeric characters.
 * Check any nonce read from a response or payload with it before using it.
 */
export function isMarkerNonce (value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= MARKER_NONCE_MIN_LENGTH &&
    MARKER_NONCE_RE.test(value)
  )
}

/**
 * The page's slots if `name` is one of their own slot functions, else an empty object.
 * A slot marker's name comes from HTML, so it may be an inherited key or Vue's internal `_` flag,
 * which `renderSlot` would otherwise call.
 */
export function ownSlots (slots: Slots | undefined, name: string): Slots {
  return slots && name !== '_' && Object.hasOwn(slots, name) && typeof slots[name] === 'function' ? slots : {}
}

/**
 * Read the marker nonces of an island response or payload entry, `undefined` when any is invalid.
 * A remote island without valid nonces, such as one from an app without islands v2, gets a fresh
 * nonce that no comment carries, so its HTML stays static.
 */
export function readMarkerNonces (data: { nonce?: unknown, nonces?: unknown } | undefined, remote: boolean): MarkerNonces | undefined {
  if (!data) { return }
  const { nonce, nonces } = data
  if (!isMarkerNonce(nonce) || (nonces !== undefined && (!Array.isArray(nonces) || !nonces.every(isMarkerNonce)))) {
    return remote ? { nonce: createMarkerNonce() } : undefined
  }
  return nonces === undefined ? { nonce } : { nonce, nonces }
}

/**
 * Keep only the chunk paths of a remote island response that pass `isChunkPath`.
 */
export function readChunkPaths (chunks: unknown): Record<string, string> | undefined {
  if (!chunks || typeof chunks !== 'object') { return }
  return Object.fromEntries(Object.entries(chunks).filter(([, path]) => isChunkPath(path)))
}

/**
 * Whether a chunk path from a remote island response is root-relative, with no `//` prefix,
 * `.` or `..` segment, or encoded `.`, `/` or `\`. Otherwise a remote server could make
 * the host page import a script from outside the island's source URL.
 */
export function isChunkPath (value: unknown): value is string {
  return (
    typeof value === 'string' &&
    CHUNK_PATH_RE.test(value) &&
    !CHUNK_PATH_DOT_SEGMENT_RE.test(value) &&
    !ENCODED_SEPARATOR_RE.test(value)
  )
}

/**
 * Build the marker prefixes of a render from its nonce. HTML written before the nonce existed,
 * such as `v-html` user content, cannot know it, so it cannot forge a marker. The nonce is not
 * a secret and does not protect against script injected into the page, which is already XSS.
 */
export function createMarkerSet (nonce: string): MarkerSet {
  if (!isMarkerNonce(nonce)) {
    throw new Error(`[nuxt] [islands] A marker nonce must be at least ${MARKER_NONCE_MIN_LENGTH} alphanumeric characters.`)
  }
  return {
    nonce,
    component: `${MARKER_COMPONENT}:${nonce}`,
    componentEnd: `${MARKER_COMPONENT_END}:${nonce}`,
    teleport: `${MARKER_TELEPORT}:${nonce}`,
    slot: `${MARKER_SLOT}:${nonce}`,
    slotEnd: `${MARKER_SLOT_END}:${nonce}`,
  }
}

/**
 * Rebind an island response's nonces: map each to a fresh one, created once and kept in `rebound`.
 * The response nonces are public, so without this, content the page renders into the island HTML
 * (such as a slot with `v-html`) could forge markers that the client would hydrate.
 */
export function rebindMarkerNonces ({ nonce, nonces }: MarkerNonces, rebound: Map<string, string>): MarkerNonces {
  const rebind = (original: string): string => {
    let fresh = rebound.get(original)
    if (!fresh) { rebound.set(original, fresh = createMarkerNonce()) }
    return fresh
  }
  return nonces ? { nonce: rebind(nonce), nonces: nonces.map(rebind) } : { nonce: rebind(nonce) }
}

/**
 * Rebind the markers in an island response's HTML to the fresh nonces of `rebindMarkerNonces`.
 * Only the response's own nonces are replaced, so a marker copying another island's nonce
 * stays a plain comment.
 */
export function rebindMarkers (html: string, nonces: MarkerNonces, rebound: Map<string, string>): { html: string } & MarkerNonces {
  const own = new Set([nonces.nonce, ...nonces.nonces ?? []])
  const bound = rebindMarkerNonces(nonces, rebound)
  return {
    ...bound,
    html: html.replace(MARKER_NONCE_TOKEN_RE, (token, prefix: string, nonce: string) => own.has(nonce) ? prefix + rebound.get(nonce)! : token),
  }
}

/**
 * Encode marker data as JSON that cannot end or start an HTML comment:
 * `--` and `<` are written as JSON escapes, which `JSON.parse` decodes on the client.
 */
export function encodeMarker (value: unknown): string {
  return JSON.stringify(value).replaceAll('--', '-\\u002D').replaceAll('<', '\\u003C')
}

/**
 * Create a random nonce for one render: a UUID v4 without dashes (122 random bits as hex).
 */
export function createMarkerNonce (): string {
  return randomUUID().replaceAll('-', '')
}
