import type { Slots, VNode } from 'vue'
import { randomUUID } from 'uncrypto'

export type IslandComponentMarker = [
  props: Record<string, any> | null,
  chunk: string,
  exportName?: string,
  slots?: Record<string, string>,
]

export type IslandTeleportMarker = [to: string, disabled: boolean, html?: string]

/**
 * `i:s` tuple the island render writes at a root `<slot>` outlet. It carries the fallback HTML,
 * leaving the region between the markers to the page's slot content.
 */
export type IslandSlotMarker = [
  name: string,
  props: Record<string, any> | null,
  slotScopeId: string | null,
  fallback: string,
]

/**
 * Nonces an island's markers are bound to: its own, then those of the nested islands it embeds.
 */
export interface MarkerNonces {
  nonce: string
  nonces?: string[]
}

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
   * Markers of this render, bound to its nonce.
   */
  markers: MarkerSet
  /**
   * Nonces of nested islands whose markers this render embeds.
   */
  nested: Set<string>
  /**
   * Client path of each chunk the render's `v-load-client` components load, by chunk ref, for remote hosts.
   */
  chunks: Record<string, string>
  /**
   * VNode of the component the render mounts, whose own `<slot>` outlets get slot markers.
   */
  root?: VNode
}

export const MARKER_COMPONENT = 'i:c'
export const MARKER_COMPONENT_END = '/i:c'
export const MARKER_TELEPORT = 'i:t'
export const MARKER_SLOT = 'i:s'
export const MARKER_SLOT_END = '/i:s'
/**
 * Keys that would reach the prototype when a parsed record is copied; markers never carry them.
 */
export const PROTOTYPE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype'])
/**
 * Props Vue reserves on a VNode
 */
export const VNODE_RESERVED_PROPS: ReadonlySet<string> = new Set(['key', 'ref', 'ref_for', 'ref_key'])
/**
 * A Vue scope id attribute, the only value an island's `scopeId` prop or a slot marker may apply.
 */
export const VUE_SCOPE_ID_RE = /^data-v-[\w-]+$/

const MARKER_NONCE_MIN_LENGTH = 16
const MARKER_NONCE_RE = /^[A-Z0-9]+$/i
// A root-relative path not starting with `//`, without `\`, a query or a fragment.
const CHUNK_PATH_RE = /^\/(?!\/)[\w\-.~@:+%/]*$/
const CHUNK_PATH_DOT_SEGMENT_RE = /(?:^|\/)\.{1,2}(?:\/|$)/
const ENCODED_SEPARATOR_RE = /%(?:2e|2f|5c)/i
// The nonce of a marker prefix, in a comment or in a tuple's HTML at any depth of JSON escaping.
const MARKER_NONCE_TOKEN_RE = /(i:[cst]:)([a-z0-9]+)/gi

/**
 * Whether a value can bind markers: a string of 16 or more alphanumeric characters.
 * Hosts check a nonce read from a response with it before building anything from it.
 */
export function isMarkerNonce (value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= MARKER_NONCE_MIN_LENGTH &&
    MARKER_NONCE_RE.test(value)
  )
}

/**
 * The page slots when they hold `name` as their own slot function, else none: a slot marker's name
 * may be an inherited key or Vue's internal `_` flag, which `renderSlot` would call.
 */
export function ownSlots (slots: Slots | undefined, name: string): Slots {
  return slots && name !== '_' && Object.hasOwn(slots, name) && typeof slots[name] === 'function' ? slots : {}
}

/**
 * Marker nonces of an island response or payload entry, or `undefined` when any is invalid. A remote
 * island without valid ones, such as a legacy app's, gets a fresh nonce no marker carries, so it renders statically.
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
 * Chunk paths of a remote island response that are safe to import from its source; others are dropped.
 */
export function readChunkPaths (chunks: unknown): Record<string, string> | undefined {
  if (!chunks || typeof chunks !== 'object') { return }
  return Object.fromEntries(Object.entries(chunks).filter(([, path]) => isChunkPath(path)))
}

/**
 * Whether a chunk path from a remote island response stays a path on that island's source:
 * root-relative, with no other origin, protocol, `.`/`..` segment or encoded separator.
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
 * Build the marker set of a render. The nonce stops raw HTML rendered before it existed
 * (`v-html`, user content) from forging a marker. It is not a secret and does not guard
 * against a runtime DOM injection, which is already XSS.
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
 * Fresh nonces for an island response the server renders content into, kept per original nonce in the
 * island's own `rebound`: content made before then, such as remote HTML or `v-html` in a slot, cannot know them.
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
 * Bind the markers of an island response's HTML to the nonces `rebindMarkerNonces` gives it.
 * Only the response's own nonces are rebound, so a marker it holds for another island stays inert.
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
 * Encode a marker tuple as JSON that cannot close or open an HTML comment:
 * `--` and `<` become JSON escape text, which `JSON.parse` decodes on the client.
 */
export function encodeMarker (value: unknown): string {
  return JSON.stringify(value).replaceAll('--', '-\\u002D').replaceAll('<', '\\u003C')
}

/**
 * Random per-render nonce for marker prefixes: a UUID v4 without dashes, 122 random bits as hex.
 */
export function createMarkerNonce (): string {
  return randomUUID().replaceAll('-', '')
}
