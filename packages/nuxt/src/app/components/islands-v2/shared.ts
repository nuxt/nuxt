import type { VNode } from 'vue'
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
