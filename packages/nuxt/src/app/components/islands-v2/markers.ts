import { isPlainObject, isString } from '@vue/shared'
import {
  type IslandComponentMarker,
  type IslandSlotMarker,
  type IslandTeleportMarker,
  PROTOTYPE_KEYS,
  VNODE_RESERVED_PROPS,
  VUE_SCOPE_ID_RE,
} from './shared'

/**
 * Role of a comment in a region scan: opening a nested region, closing one, or neither.
 */
export type RegionToken = 'open' | 'close' | undefined

// Comment data of the anchors Vue renders around fragments and teleports.
export const FRAGMENT_START = '['
export const FRAGMENT_END = ']'
export const TELEPORT_START = 'teleport start'
export const TELEPORT_END = 'teleport end'

/**
 * First item closing the region opened right before `items`, skipping the regions nested in it.
 */
export function findRegionEnd<T> (items: Iterable<T>, tokenOf: (item: T) => RegionToken): T | undefined {
  let depth = 0
  for (const item of items) {
    const token = tokenOf(item)
    if (token === 'open') {
      depth++
    } else if (token === 'close') {
      if (depth === 0) { return item }
      depth--
    }
  }
  return undefined
}

/**
 * Whether a decoded `i:s` tuple is well formed as the island render writes it: a slot name that
 * cannot reach the prototype, plain props without reserved keys, a Vue scope id or `null`, and the fallback HTML.
 */
export function isSlotMarker (value: unknown): value is IslandSlotMarker {
  if (!Array.isArray(value) || value.length !== 4) { return false }
  const [name, props, slotScopeId, fallback] = value as unknown[]
  return (
    typeof name === 'string' &&
    !PROTOTYPE_KEYS.has(name) &&
    isMarkerProps(props) &&
    (slotScopeId === null || (typeof slotScopeId === 'string' && VUE_SCOPE_ID_RE.test(slotScopeId))) &&
    typeof fallback === 'string'
  )
}

export function isComponentMarker (value: unknown): value is IslandComponentMarker {
  if (!Array.isArray(value)) { return false }
  const [props, chunk, exportName, slots] = value as unknown[]
  return (
    typeof chunk === 'string' &&
    isMarkerProps(props) &&
    (exportName === undefined || typeof exportName === 'string') &&
    (slots === undefined || (isPlainObject(slots) && !hasKeyIn(slots, PROTOTYPE_KEYS) && Object.values(slots).every(isString)))
  )
}

export function isTeleportMarker (value: unknown): value is IslandTeleportMarker {
  if (!Array.isArray(value)) { return false }
  const [to, disabled, html] = value as unknown[]
  return (
    typeof to === 'string' &&
    typeof disabled === 'boolean' &&
    (html === undefined || typeof html === 'string')
  )
}

/**
 * Whether comment data starts with a marker prefix followed by its JSON tuple.
 */
export function hasMarkerPrefix (data: string, marker: string): boolean {
  return data.startsWith(`${marker}[`)
}

/**
 * Parse a marker's JSON tuple, `undefined` when malformed.
 */
export function tryDecodeMarker (json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return
  }
}

function isMarkerProps (props: unknown): boolean {
  return props === null || (isPlainObject(props) && !hasKeyIn(props, PROTOTYPE_KEYS) && !hasKeyIn(props, VNODE_RESERVED_PROPS))
}

// Marker props are plain JSON.parse output, unlike the devalue payload.
function hasKeyIn (record: object, keys: ReadonlySet<string>): boolean {
  return Object.keys(record).some(key => keys.has(key))
}
