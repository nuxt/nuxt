import { Fragment, createElementVNode, createStaticVNode, renderSlot } from 'vue'
import type { Slots, VNode } from 'vue'
import type { MarkerSet } from './shared'
import { isSlotMarker, tryDecodeMarker } from './markers'

// `slotScopeIds` is internal to Vue's VNode type.
type SlottedVNode = VNode & { slotScopeIds?: string[] }

const COMMENT_END = '-->'

/**
 * Server render of island HTML with the page's slots in the island's own `i:s` regions, which the
 * island render leaves empty with the fallback in the marker (see `IslandSlotMarker`).
 */
export function renderIslandSlots (html: string, markers: MarkerSet, slots: Slots): VNode {
  const vnodes = renderParts(html, markers, slots)
  return vnodes.length === 1 ? vnodes[0]! : createElementVNode(Fragment, null, vnodes)
}

function renderParts (html: string, markers: MarkerSet, slots: Slots): VNode[] {
  const open = `<!--${markers.slot}[`
  const close = `<!--${markers.slotEnd}${COMMENT_END}`
  const vnodes: VNode[] = []
  let from = 0
  // Marker JSON never holds `-->` or `<`, so outlets nested in a fallback stay inside its tuple.
  for (let start = html.indexOf(open); start !== -1; start = html.indexOf(open, start + open.length)) {
    const contentStart = html.indexOf(COMMENT_END, start + open.length) + COMMENT_END.length
    if (contentStart < COMMENT_END.length || !html.startsWith(close, contentStart)) { continue }
    const tuple = tryDecodeMarker(html.slice(start + open.length - 1, contentStart - COMMENT_END.length))
    if (!isSlotMarker(tuple)) { continue }
    const [name, props, slotScopeId, fallback] = tuple
    vnodes.push(createStaticVNode(html.slice(from, contentStart), 1))
    const slot = renderSlot(slots, name, props ?? {}, () => renderParts(fallback, markers, slots), true)
    if (slotScopeId) { (slot as SlottedVNode).slotScopeIds = [slotScopeId] }
    vnodes.push(slot)
    from = contentStart
  }
  vnodes.push(createStaticVNode(html.slice(from), 1))
  return vnodes
}
