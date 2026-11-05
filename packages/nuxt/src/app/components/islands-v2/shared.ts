import { randomUUID } from 'uncrypto'

/**
 * Descriptor of a `v-load-client` component, carried by its `i:c` marker:
 * type tag, props without listeners or reserved keys, chunk, export name and slot HTML.
 */
export type IslandComponentMarker = [
  type: typeof COMPONENT_MARKER_TYPE,
  props: Record<string, any> | null,
  chunk: string,
  exportName?: string,
  slots?: Record<string, string>,
]

/**
 * Descriptor of a server-rendered teleport, carried by its `i:t` marker; `html` is omitted when disabled.
 */
export type IslandTeleportMarker = [to: string, disabled: boolean, html?: string]

/**
 * Comment data of every marker kind, bound to one render's nonce.
 */
export interface MarkerSet {
  nonce: string
  component: string
  componentEnd: string
  teleport: string
}

export const MARKER_COMPONENT = 'i:c'
export const MARKER_COMPONENT_END = '/i:c'
export const MARKER_TELEPORT = 'i:t'
export const COMPONENT_MARKER_TYPE = 1
/**
 * Keys that would reach the prototype when a parsed record is copied; markers never carry them.
 */
export const PROTOTYPE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype'])
/**
 * Props Vue reserves on a VNode; markers and DOM attributes never forward them.
 */
export const VNODE_RESERVED_PROPS: ReadonlySet<string> = new Set(['key', 'ref', 'ref_for', 'ref_key'])

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
  }
}

/**
 * Random per-render nonce for marker prefixes: a UUID v4 without dashes, 122 random bits as hex.
 */
export function createMarkerNonce (): string {
  return randomUUID().replaceAll('-', '')
}
