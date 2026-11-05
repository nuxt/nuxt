import {
  Fragment,
  Static,
  Suspense,
  Teleport,
  type VNode,
  createCommentVNode,
  createElementVNode,
  createStaticVNode,
  createVNode,
  h,
  isVNode,
} from 'vue'
import { escapeHtml, isPlainObject, isString } from '@vue/shared'
import {
  COMPONENT_MARKER_TYPE,
  type IslandComponentMarker,
  type IslandTeleportMarker,
  type MarkerSet,
  PROTOTYPE_KEYS,
  VNODE_RESERVED_PROPS,
  createMarkerSet,
} from './shared'
import loader from './loader'

export interface DomToVNodeOptions {
  /**
   * Nonce the server bound the island's own markers to; comments without a known nonce stay plain comments.
   */
  nonce: string
  /**
   * Nonces of nested islands whose markers the HTML embeds, accepted besides `nonce`.
   */
  nonces?: readonly string[]
  /**
   * Makes static runs adopt the live DOM in place, as hydration needs.
   *
   * @default true
   * @remarks `false` suits a detached DOM, such as HTML parsed from a fetch; `htmlToVNode` always sets it.
   */
  adopt?: boolean
  /**
   * Tree currently rendered for the island, whose static runs are kept where the new DOM is unchanged.
   */
  previous?: VNode
}

type DecodedMarker =
  | { kind: 'component', tuple: IslandComponentMarker, markers: MarkerSet }
  | { kind: 'teleport', tuple: IslandTeleportMarker, markers: MarkerSet }

interface WalkContext {
  adopt: boolean
  /**
   * Decoded marker of each comment read so far, `null` for a plain comment.
   */
  decoded: WeakMap<Comment, DecodedMarker | null>
  markerAncestors: Set<Node>
  /**
   * Only comments carrying one of these nonce-bound prefixes and a valid tuple are markers.
   */
  markerSets: MarkerSet[]
  options: DomToVNodeOptions
  previousRuns?: Map<string, VNode[]>
  /**
   * Static runs carry their HTML instead of parsed nodes to clone.
   */
  serialize?: boolean
}

interface WalkResult {
  next: ChildNode | null
  vnodes: VNode[]
}

const COMMENT_NODE = 8
const ELEMENT_NODE = 1
const FRAGMENT_END = ']'
const FRAGMENT_START = '['
const SHOW_COMMENT = 128
const TELEPORT_END = 'teleport end'
const TELEPORT_START = 'teleport start'
const TEXT_NODE = 3
let STATIC_RUN_ID = 0

/**
 * Rebuild a hydratable VNode tree from the island root DOM node.
 */
export function domToVNode (start: Node, options: DomToVNodeOptions): VNode | undefined {
  const context = createWalkContext(start, options)
  return wrapRoot(walkNode(start as ChildNode, context).vnodes)
}

/**
 * Parse marked HTML for an update; pass the rendered tree as `previous` to keep unchanged static runs.
 */
export function htmlToVNode (html: string, options: DomToVNodeOptions): VNode | undefined {
  const { content } = parseHtml(html)
  if (!content.firstChild) { return }
  const context = createWalkContextForScope(content, content, { ...options, adopt: false })
  if (content.childNodes.length === 1) { return wrapRoot(walkNode(content.firstChild, context).vnodes) }
  const children = walkSiblings(content.firstChild, null, context)
  if (children.length === 1 && children[0]?.type === Fragment) { return children[0] }
  return createElementVNode(Fragment, null, children)
}

/**
 * Parse marked HTML into sibling VNodes for slot content: the parent renders the anchors
 * and each static run carries its HTML so one VNode can hydrate or mount, then be cloned.
 */
export function htmlToVNodes (html: string, options: DomToVNodeOptions): VNode[] {
  const { content } = parseHtml(html)
  if (!content.firstChild) { return [] }
  const context = createWalkContextForScope(content, content, { ...options, adopt: false })
  context.serialize = true
  return walkSiblings(content.firstChild, null, context)
}

function parseHtml (html: string): HTMLTemplateElement {
  const template = document.createElement('template')
  template.innerHTML = html
  return template
}

function createWalkContext (start: Node, options: DomToVNodeOptions): WalkContext {
  if (isFragmentStart(start)) {
    const parent = start.parentNode
    return createWalkContextForScope(parent ?? start, parent ?? null, options)
  }

  const scope = start.nodeType === ELEMENT_NODE ? start : (start.parentNode ?? start)
  return createWalkContextForScope(scope, start.parentNode, options)
}

function createWalkContextForScope (
  scopeRoot: Node,
  islandParent: Node | null,
  options: DomToVNodeOptions,
): WalkContext {
  const context: WalkContext = {
    adopt: options.adopt ?? true,
    decoded: new WeakMap(),
    markerAncestors: new Set(),
    markerSets: [options.nonce, ...options.nonces ?? []].map(createMarkerSet),
    options,
    previousRuns:
      options.adopt === false && options.previous ? collectStaticRuns(options.previous) : undefined,
  }
  collectMarkerAncestors(scopeRoot, islandParent, context)
  return context
}

function collectMarkerAncestors (
  scopeRoot: Node,
  islandParent: Node | null,
  context: WalkContext,
): void {
  const ancestors = context.markerAncestors
  const ownerDocument = scopeRoot.ownerDocument ?? document
  const treeWalker = ownerDocument.createTreeWalker(scopeRoot, SHOW_COMMENT)

  for (let current = treeWalker.nextNode(); current; current = treeWalker.nextNode()) {
    if (!readMarker(current as Comment, context)) { continue }

    for (let ancestor = current.parentNode; ancestor && ancestor !== islandParent;) {
      if (ancestor.nodeType === ELEMENT_NODE) { ancestors.add(ancestor) }
      ancestor = ancestor.parentNode
    }
  }
}

/**
 * Walk one node into its VNodes and return the sibling to continue from.
 */
function walkNode (node: ChildNode, context: WalkContext): WalkResult {
  // Structural comments carry no nonce, so an unmatched one (raw HTML) stays a plain comment.
  const fragmentEnd = isFragmentStart(node) ? findFragmentEnd(node) : undefined
  if (fragmentEnd) {
    const children = walkSiblings(node.nextSibling, fragmentEnd, context)
    return {
      next: fragmentEnd.nextSibling,
      vnodes: [createElementVNode(Fragment, null, children)],
    }
  }

  if (node.nodeType === COMMENT_NODE) {
    const marker = readMarker(node as Comment, context)
    const result = marker && handleMarkerComment(node as Comment, marker, context)
    return (
      result || { next: node.nextSibling, vnodes: [createCommentVNode((node as Comment).data)] }
    )
  }

  if (node.nodeType === ELEMENT_NODE && context.markerAncestors.has(node)) {
    return {
      next: node.nextSibling,
      vnodes: [walkMarkerAncestorElement(node as Element, context)],
    }
  }
  if (isStaticNode(node)) {
    return { next: node.nextSibling, vnodes: [createStaticRun([node], context)] }
  }
  return { next: node.nextSibling, vnodes: [] }
}

function walkSiblings (first: ChildNode | null, stop: Node | null, context: WalkContext): VNode[] {
  const vnodes: VNode[] = []
  const staticRun: Node[] = []

  for (let current = first; current && current !== stop;) {
    // Consecutive static nodes share one run instead of a VNode each.
    if (isStaticNode(current) && !context.markerAncestors.has(current)) {
      staticRun.push(current)
      current = current.nextSibling
      continue
    }
    if (staticRun.length > 0) {
      vnodes.push(createStaticRun(staticRun, context))
      staticRun.length = 0
    }
    const result = walkNode(current, context)
    vnodes.push(...result.vnodes)
    current = result.next
  }

  if (staticRun.length > 0) { vnodes.push(createStaticRun(staticRun, context)) }
  return vnodes
}

function walkMarkerAncestorElement (element: Element, context: WalkContext): VNode {
  return createElementVNode(
    element.localName,
    readAttributes(element) ?? null,
    walkSiblings(element.firstChild, null, context),
  )
}

/**
 * VNodes of a decoded marker, or `undefined` when a teleport marker has no teleport after it.
 */
function handleMarkerComment (
  comment: Comment,
  marker: DecodedMarker,
  context: WalkContext,
): WalkResult | undefined {
  if (marker.kind === 'component') {
    const closing = findClosingMarker(comment, marker.markers, context)
    if (!closing) { return }
    return {
      next: closing.nextSibling,
      vnodes: [
        createCommentVNode(comment.data),
        renderClientComponent(marker.tuple, context.options),
        createCommentVNode(marker.markers.componentEnd),
      ],
    }
  }

  const start = comment.nextSibling
  if (!start || !isTeleportStart(start)) { return }
  const end = findTeleportEnd(start)
  if (!end) { return }
  const [to, disabled, html] = marker.tuple
  // Disabled content sits inline; otherwise it lives in the target and travels in the marker.
  const children = disabled
    ? walkSiblings(start.nextSibling, end, context)
    : htmlToVNodes(html ?? '', context.options)
  return {
    next: end.nextSibling,
    vnodes: [createCommentVNode(comment.data), createVNode(Teleport, { to, disabled }, children)],
  }
}

/**
 * Decode and validate a nonce-bound marker comment, cached per comment; `null` means a plain comment.
 */
function readMarker (comment: Comment, context: WalkContext): DecodedMarker | null {
  let marker = context.decoded.get(comment)
  if (marker === undefined) {
    marker = decodeMarkerComment(comment.data, context.markerSets)
    context.decoded.set(comment, marker)
  }
  return marker
}

function decodeMarkerComment (data: string, markerSets: MarkerSet[]): DecodedMarker | null {
  for (const markers of markerSets) {
    if (hasMarkerPrefix(data, markers.component)) {
      const tuple = tryDecodeMarker(data.slice(markers.component.length))
      return isComponentMarker(tuple) ? { kind: 'component', tuple, markers } : null
    }
    if (hasMarkerPrefix(data, markers.teleport)) {
      const tuple = tryDecodeMarker(data.slice(markers.teleport.length))
      return isTeleportMarker(tuple) ? { kind: 'teleport', tuple, markers } : null
    }
  }
  return null
}

function tryDecodeMarker (json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return
  }
}

function isComponentMarker (value: unknown): value is IslandComponentMarker {
  if (!Array.isArray(value)) { return false }
  const [type, props, chunk, exportName, slots] = value as unknown[]
  return (
    type === COMPONENT_MARKER_TYPE &&
    typeof chunk === 'string' &&
    (props === null || (isPlainObject(props) && !hasKeyIn(props, PROTOTYPE_KEYS) && !hasKeyIn(props, VNODE_RESERVED_PROPS))) &&
    (exportName === undefined || typeof exportName === 'string') &&
    (slots === undefined || (isPlainObject(slots) && !hasKeyIn(slots, PROTOTYPE_KEYS) && Object.values(slots).every(isString)))
  )
}

function isTeleportMarker (value: unknown): value is IslandTeleportMarker {
  if (!Array.isArray(value)) { return false }
  const [to, disabled, html] = value as unknown[]
  return (
    typeof to === 'string' &&
    typeof disabled === 'boolean' &&
    (html === undefined || typeof html === 'string')
  )
}

// Marker props are plain JSON.parse output, unlike the devalue payload.
function hasKeyIn (record: object, keys: ReadonlySet<string>): boolean {
  return Object.keys(record).some(key => keys.has(key))
}

/**
 * Closing comment of a component marker; only valid open markers of the same nonce count as nested.
 */
function findClosingMarker (start: Comment, markers: MarkerSet, context: WalkContext): Comment | undefined {
  let depth = 0
  for (let current = start.nextSibling; current; current = current.nextSibling) {
    if (current.nodeType !== COMMENT_NODE) { continue }
    const comment = current as Comment
    if (comment.data === markers.componentEnd) {
      if (depth === 0) { return comment }
      depth--
    } else {
      const marker = readMarker(comment, context)
      if (marker?.kind === 'component' && marker.markers === markers) { depth++ }
    }
  }
  return undefined
}

function findTeleportEnd (start: Node): Comment | undefined {
  let depth = 0
  for (let current: Node | null = start; current; current = current.nextSibling) {
    if (current.nodeType !== COMMENT_NODE) { continue }
    const data = (current as Comment).data
    if (data === TELEPORT_START) {
      depth++
    } else if (data === TELEPORT_END) {
      depth--
      if (depth === 0) { return current as Comment }
    }
  }
  return undefined
}

function findFragmentEnd (start: Node): Comment | undefined {
  let depth = 0
  for (let current = start.nextSibling; current; current = current.nextSibling) {
    if (current.nodeType !== COMMENT_NODE) { continue }
    const data = (current as Comment).data
    if (data === FRAGMENT_START) {
      depth++
    } else if (data === FRAGMENT_END) {
      if (depth === 0) { return current as Comment }
      depth--
    }
  }
  return undefined
}

function collectStaticRuns (previous: VNode): Map<string, VNode[]> {
  const runs = new Map<string, VNode[]>()
  const visit = (vnode: VNode): void => {
    if (vnode.type === Static) {
      // A run that was never mounted or hydrated has no DOM to compare against.
      if (!vnode.el) { return }
      const key = staticRunKey(
        vnode.el as Node,
        (vnode as VNode & { staticCount: number }).staticCount,
      )
      const matches = runs.get(key)
      if (matches) { matches.push(vnode) } else { runs.set(key, [vnode]) }
    } else if (
      (vnode.type === Fragment || typeof vnode.type === 'string') &&
      Array.isArray(vnode.children)
    ) {
      for (const child of vnode.children) {
        if (isVNode(child)) { visit(child) }
      }
    }
  }
  visit(previous)
  return runs
}

function createStaticRun (nodes: Node[], context: WalkContext): VNode {
  const previous = context.previousRuns ? findPreviousRun(nodes, context.previousRuns) : undefined
  if (previous) { return previous }
  const vnode = createStaticVNode('', nodes.length)
  // Production Vue never transfers DOM anchors between distinct Static vnodes.
  vnode.key = ++STATIC_RUN_ID
  // Vue clones mounted children and reconstructs their keys from props.
  vnode.props = { key: vnode.key }
  if (context.serialize) {
    // Carrying the HTML lets the same VNode mount or hydrate once and be cloned on later renders.
    vnode.children = nodes.map(serializeStaticNode).join('')
  } else if (!context.adopt) {
    // With anchors set, Vue clones the parsed nodes at mount instead of parsing the HTML again.
    vnode.el = nodes[0]!
    vnode.anchor = nodes[nodes.length - 1]!;
    // A memo keeps Vue from cloning the vnode on re-render: production Vue never moves `el`
    // from one Static vnode to another, so a clone would keep pointing at the parsed nodes.
    (vnode as VNode & { memo?: unknown[] }).memo = []
  }
  return vnode
}

function serializeStaticNode (node: Node): string {
  if (node.nodeType === ELEMENT_NODE) { return (node as Element).outerHTML }
  if (node.nodeType === TEXT_NODE) { return escapeHtml((node as Text).data) }
  return ''
}

function findPreviousRun (nodes: Node[], runs: Map<string, VNode[]>): VNode | undefined {
  const candidates = runs.get(staticRunKey(nodes[0]!, nodes.length))
  if (!candidates) { return }
  const index = candidates.findIndex(run => sameStaticRun(nodes, run.el as Node))
  if (index === -1) { return }
  return candidates.splice(index, 1)[0]
}

function sameStaticRun (nodes: Node[], first: Node): boolean {
  let current: Node | null = first
  for (const node of nodes) {
    if (!current || !node.isEqualNode(current)) { return false }
    current = current.nextSibling
  }
  return true
}

function staticRunKey (first: Node, count: number): string {
  return `${count}:${first.nodeName}`
}

function readAttributes (element: Element): Record<string, string> | undefined {
  let props: Record<string, string> | undefined
  for (const name of element.getAttributeNames()) {
    if (VNODE_RESERVED_PROPS.has(name)) { continue }
    (props ??= {})[name] = element.getAttribute(name) ?? ''
  }
  return props
}

function isFragmentStart (node: Node): boolean {
  return node.nodeType === COMMENT_NODE && (node as Comment).data === FRAGMENT_START
}

function isTeleportStart (node: Node): boolean {
  return node.nodeType === COMMENT_NODE && (node as Comment).data === TELEPORT_START
}

function isStaticNode (node: Node): boolean {
  return node.nodeType === ELEMENT_NODE || node.nodeType === TEXT_NODE
}

function hasMarkerPrefix (data: string, marker: string): boolean {
  return data.startsWith(`${marker}[`)
}

function wrapRoot (vnodes: VNode[]): VNode | undefined {
  if (vnodes.length === 0) { return }
  if (vnodes.length === 1) { return vnodes[0] }
  return createElementVNode(Fragment, null, vnodes)
}

/**
 * Keep component loading inside the surrounding Vue render context.
 */
function renderClientComponent (data: IslandComponentMarker, options: DomToVNodeOptions): VNode {
  return h(Suspense, null, {
    default: () => h(loader, { data, nonce: options.nonce, nonces: options.nonces }),
  })
}
