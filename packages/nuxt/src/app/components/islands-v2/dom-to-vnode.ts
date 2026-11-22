import {
  Fragment,
  type Slots,
  Static,
  Suspense,
  Teleport,
  type VNode,
  cloneVNode,
  createCommentVNode,
  createElementVNode,
  createStaticVNode,
  createVNode,
  defineComponent,
  h,
  isVNode,
} from 'vue'
import { escapeHtml } from '@vue/shared'
import {
  type IslandComponentMarker,
  type IslandSlotMarker,
  type IslandTeleportMarker,
  type MarkerSet,
  VNODE_RESERVED_PROPS,
  createMarkerSet,
} from './shared'
import {
  FRAGMENT_END,
  FRAGMENT_START,
  type RegionToken,
  TELEPORT_END,
  TELEPORT_START,
  findRegionEnd,
  hasMarkerPrefix,
  isComponentMarker,
  isSlotMarker,
  isTeleportMarker,
  tryDecodeMarker,
} from './markers'
import loader from './loader'
import slotOutlet from './slot-outlet'

export interface DomToVNodeOptions {
  /**
   * Nonce of the island's own markers. Comments without an accepted nonce stay plain comments.
   */
  nonce: string
  /**
   * Nonces of nested islands whose markers the HTML includes, accepted besides `nonce`.
   */
  nonces?: readonly string[]
  /**
   * Makes static runs reuse the live DOM nodes in place, as hydration needs.
   *
   * @default true
   * @remarks `false` suits a detached DOM, such as HTML parsed from a fetch; `htmlToVNode` always sets it.
   */
  adopt?: boolean
  /**
   * Tree currently rendered for the island; its static runs are reused where the new DOM is unchanged.
   */
  previous?: VNode
  /**
   * Slots the page passed to the island, rendered at the island's slot outlets.
   */
  slots?: Slots
  /**
   * Source of an island fetched from another app. Its teleport markers stay plain comments,
   * and its client components stay static unless their chunk is listed.
   */
  remote?: RemoteIsland
}

export interface RemoteIsland {
  /**
   * Base URL the island was fetched from.
   */
  source: string
  /**
   * Client path of each chunk the host may import from `source`, by chunk ref,
   * already checked with `isChunkPath`.
   */
  chunks?: Record<string, string>
}

type DecodedMarker =
  | { kind: 'component', tuple: IslandComponentMarker, markers: MarkerSet }
  | { kind: 'teleport', tuple: IslandTeleportMarker, markers: MarkerSet }
  | { kind: 'slot', tuple: IslandSlotMarker, markers: MarkerSet }

interface WalkContext {
  adopt: boolean
  /**
   * Cache of the decoded marker of each comment read so far.
   *
   * @remarks `null` marks a plain comment
   */
  decoded: WeakMap<Comment, DecodedMarker | null>
  /**
   * Elements that contain a marker. They become element VNodes, never part of a static run.
   */
  markerAncestors: Set<Node>
  /**
   * Prefixes of the accepted nonces. A comment is a marker only with one of them and valid data.
   */
  markerSets: MarkerSet[]
  options: DomToVNodeOptions
  /**
   * Reads every comment as a plain comment, for HTML that only stays on screen until it is replaced.
   */
  plain?: boolean
  previousRuns?: Map<string, VNode[]>
  /**
   * Makes each static node a `StaticNode` component carrying its HTML, instead of a static run
   * pointing at parsed nodes, so copies made with `cloneVNodes` can mount anywhere.
   */
  serialize?: boolean
}

interface WalkResult {
  next: ChildNode | null
  vnodes: VNode[]
}

type InternalVNode = VNode & { ssContent?: VNode | null, ssFallback?: VNode | null, memo?: unknown[] }

const COMMENT_NODE = 8
const ELEMENT_NODE = 1
const SHOW_COMMENT = 128
const TEXT_NODE = 3
let STATIC_RUN_ID = 0

/**
 * Build a VNode tree that hydrates the island's server-rendered DOM, starting at its root node.
 */
export function domToVNode (start: Node, options: DomToVNodeOptions): VNode | undefined {
  // An island whose root is a marker, such as a lone `v-load-client` component, has no fragment
  // anchors around its nodes, so its walk runs to the end of the parent.
  const end = isFragmentStart(start) || start.nodeType === ELEMENT_NODE ? rootEnd(start) ?? start : null
  const context = createWalkContext(start, end, options)
  return wrapRoot(walkNode(start as ChildNode, context, end?.nextSibling ?? null).vnodes)
}

/**
 * Parse island HTML for a client update. Pass the rendered tree as `previous`
 * to reuse its unchanged static runs.
 */
export function htmlToVNode (html: string, options: DomToVNodeOptions): VNode | undefined {
  const { content } = parseHtml(html)
  if (!content.firstChild) { return }
  const context = createWalkContextForScope(content, content, { ...options, adopt: false })
  if (content.childNodes.length === 1) { return wrapRoot(walkNode(content.firstChild, context, null).vnodes) }
  const children = walkSiblings(content.firstChild, null, context)
  if (children.length === 1 && children[0]?.type === Fragment) { return children[0] }
  return createElementVNode(Fragment, null, children)
}

/**
 * Parse island HTML into sibling VNodes, for slot, fallback and teleport content. Code that renders
 * the result more than once must render copies made with `cloneVNodes`, not the result itself.
 */
export function htmlToVNodes (html: string, options: DomToVNodeOptions): VNode[] {
  const { content } = parseHtml(html)
  if (!content.firstChild) { return [] }
  const context = createWalkContextForScope(content, content, { ...options, adopt: false })
  context.serialize = true
  return walkSiblings(content.firstChild, null, context)
}

/**
 * HTML of a hydrated island, stored in its payload entry, with its slot outlets emptied:
 * what the page rendered there is not part of the island, and a later render fills them again.
 */
export function outerHTMLOf (start: Node, nonce: string): string {
  // Without its end, the island's extent is unknown.
  // Empty HTML makes the next mount fetch the island again.
  const end = rootEnd(start)
  if (!end) { return '' }
  const copy = (start.ownerDocument ?? document).createDocumentFragment()
  for (let current: Node | null = start; current; current = current.nextSibling) {
    copy.append(current.cloneNode(true))
    if (current === end) { break }
  }
  // An outlet without its closing comment means the island ended early, so its HTML is incomplete.
  if (emptySlotRegions(copy, createMarkerSet(nonce))) { return '' }
  let html = ''
  for (const node of copy.childNodes) { html += serializeNode(node) }
  return html
}

/**
 * Copy VNodes built by the DOM walk into ones Vue has never mounted. Vue mounts a component VNode
 * that still holds the `el` of an earlier mount by hydrating that stale DOM, so reused VNodes break.
 */
export function cloneVNodes (vnodes: VNode[]): VNode[] {
  return vnodes.map(cloneVNodeTree)
}

/**
 * Renders the HTML of one static node. Each instance owns its `Static` VNode, so copies of the same
 * walk result can mount side by side. One node per component, as Vue hydrates a component root
 * as a single DOM node.
 */
const StaticNode = /* @__PURE__ */ defineComponent({
  name: 'NuxtIslandStaticNode',
  props: {
    html: {
      type: String,
      required: true,
    },
  },
  setup (props) {
    const vnode = createStaticVNode(props.html, 1)
    return () => vnode
  },
})

function parseHtml (html: string): HTMLTemplateElement {
  const template = document.createElement('template')
  template.innerHTML = html
  return template
}

function createWalkContext (start: Node, end: Node | null, options: DomToVNodeOptions): WalkContext {
  const context = createEmptyWalkContext(options)
  for (let current: Node | null = start; current; current = current.nextSibling) {
    collectMarkerAncestors(current, start.parentNode, context)
    if (current === end) { break }
  }
  return context
}

function createWalkContextForScope (
  scopeRoot: Node,
  islandParent: Node | null,
  options: DomToVNodeOptions,
): WalkContext {
  const context = createEmptyWalkContext(options)
  collectMarkerAncestors(scopeRoot, islandParent, context)
  return context
}

function createEmptyWalkContext (options: DomToVNodeOptions): WalkContext {
  return {
    adopt: options.adopt ?? true,
    decoded: new WeakMap(),
    markerAncestors: new Set(),
    markerSets: [options.nonce, ...options.nonces ?? []].map(createMarkerSet),
    options,
    previousRuns:
      options.adopt === false && options.previous ? collectStaticRuns(options.previous) : undefined,
  }
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
 * Walk one node into its VNodes and return the sibling to continue from, never past `stop`:
 * a region whose end lies at or after `stop` reads as a plain comment.
 */
function walkNode (node: ChildNode, context: WalkContext, stop: Node | null): WalkResult {
  // Fragment anchors carry no nonce; one without a matching end (e.g. from raw HTML) stays a comment.
  const fragmentEnd = isFragmentStart(node) ? findFragmentEnd(node, stop) : undefined
  if (fragmentEnd) {
    const children = walkSiblings(node.nextSibling, fragmentEnd, context)
    return {
      next: fragmentEnd.nextSibling,
      vnodes: [createElementVNode(Fragment, null, children)],
    }
  }

  if (node.nodeType === COMMENT_NODE) {
    const marker = readMarker(node as Comment, context)
    const result = marker && handleMarkerComment(node as Comment, marker, context, stop)
    return (
      result || { next: node.nextSibling, vnodes: [createCommentVNode((node as Comment).data)] }
    )
  }

  if (node.nodeType === ELEMENT_NODE && context.markerAncestors.has(node)) {
    return {
      next: node.nextSibling,
      vnodes: [createElementVNode(
        (node as Element).localName,
        readAttributes(node as Element) ?? null,
        walkSiblings(node.firstChild, null, context),
      )],
    }
  }
  if (isStaticNode(node)) {
    return { next: node.nextSibling, vnodes: createStaticRun([node], context) }
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
      vnodes.push(...createStaticRun(staticRun, context))
      staticRun.length = 0
    }
    const result = walkNode(current, context, stop)
    vnodes.push(...result.vnodes)
    current = result.next
  }

  if (staticRun.length > 0) { vnodes.push(...createStaticRun(staticRun, context)) }
  return vnodes
}

/**
 * VNodes for a decoded marker, or `undefined` when its closing comment or teleport anchors are missing.
 */
function handleMarkerComment (
  comment: Comment,
  marker: DecodedMarker,
  context: WalkContext,
  stop: Node | null,
): WalkResult | undefined {
  if (marker.kind === 'slot') {
    return handleSlotMarker(comment, marker, context, stop)
  }

  if (marker.kind === 'component') {
    const closing = findClosingMarker(comment, marker, context, stop)
    if (!closing) { return }
    return {
      next: closing.nextSibling,
      vnodes: [
        createCommentVNode(comment.data),
        renderClientComponent(marker.tuple, context.options, mountFallback(comment, closing, marker.tuple, context)),
        createCommentVNode(marker.markers.componentEnd),
      ],
    }
  }

  const start = comment.nextSibling
  if (!start || start === stop || start.nodeType !== COMMENT_NODE || (start as Comment).data !== TELEPORT_START) { return }
  const end = findAnchorEnd(start, TELEPORT_START, TELEPORT_END, stop)
  if (!end) { return }
  const [to, disabled, html] = marker.tuple
  // Disabled content sits inline. Enabled content was rendered into the target,
  // so its HTML comes from the marker.
  const children = disabled
    ? walkSiblings(start.nextSibling, end, context)
    : htmlToVNodes(html ?? '', context.options)
  return {
    next: end.nextSibling,
    vnodes: [createCommentVNode(comment.data), createVNode(Teleport, { to, disabled }, children)],
  }
}

/**
 * Render the page's slot at a slot outlet, or the marker's fallback HTML
 * when the page passes no such slot.
 */
function handleSlotMarker (
  comment: Comment,
  marker: Extract<DecodedMarker, { kind: 'slot' }>,
  context: WalkContext,
  stop: Node | null,
): WalkResult | undefined {
  const closing = findClosingMarker(comment, marker, context, stop)
  if (!closing) { return }
  const [name, props, slotScopeId, fallback] = marker.tuple
  return {
    next: closing.nextSibling,
    vnodes: [
      createCommentVNode(comment.data),
      h(slotOutlet, {
        islandSlots: context.options.slots,
        name,
        slotProps: props,
        fallback: htmlToVNodes(fallback, context.options),
        slotScopeId: slotScopeId ?? undefined,
      }),
      createCommentVNode(marker.markers.slotEnd),
    ],
  }
}

/**
 * Decode and validate a marker comment, caching the result per comment; `null` means a plain comment.
 */
function readMarker (comment: Comment, context: WalkContext): DecodedMarker | null {
  if (context.plain) { return null }
  let marker = context.decoded.get(comment)
  if (marker === undefined) {
    marker = decodeMarkerComment(comment.data, context.markerSets, context.options.remote)
    context.decoded.set(comment, marker)
  }
  return marker
}

/**
 * Decode comment data into a marker when it has an accepted prefix and valid data, else `null`.
 * For a remote island, teleport markers are ignored, or its server could place content anywhere
 * in the host page; component markers only count when the host may import their chunk.
 */
function decodeMarkerComment (data: string, markerSets: MarkerSet[], remote: RemoteIsland | undefined): DecodedMarker | null {
  // Only the island's own slot outlets are filled; a nested island's slot markers stay plain comments.
  const own = markerSets[0]!
  if (hasMarkerPrefix(data, own.slot)) {
    const tuple = tryDecodeMarker(data.slice(own.slot.length))
    return isSlotMarker(tuple) ? { kind: 'slot', tuple, markers: own } : null
  }
  for (const markers of markerSets) {
    if (hasMarkerPrefix(data, markers.component)) {
      const tuple = tryDecodeMarker(data.slice(markers.component.length))
      if (!isComponentMarker(tuple)) { return null }
      if (remote && !(remote.chunks && Object.hasOwn(remote.chunks, tuple[1]))) { return null }
      return { kind: 'component', tuple, markers }
    }
    if (remote) { continue }
    if (hasMarkerPrefix(data, markers.teleport)) {
      const tuple = tryDecodeMarker(data.slice(markers.teleport.length))
      return isTeleportMarker(tuple) ? { kind: 'teleport', tuple, markers } : null
    }
  }
  return null
}

/**
 * Find the closing comment of a component or slot marker. Only valid opening markers
 * of the same kind and nonce count as nested regions.
 */
function findClosingMarker (start: Comment, open: DecodedMarker, context: WalkContext, stop: Node | null): Comment | undefined {
  const end = open.kind === 'slot' ? open.markers.slotEnd : open.markers.componentEnd
  return findRegionEnd(siblingsAfter(start, stop), (node) => {
    if (node.nodeType !== COMMENT_NODE) { return }
    if ((node as Comment).data === end) { return 'close' }
    const marker = readMarker(node as Comment, context)
    return marker?.kind === open.kind && marker.markers === open.markers ? 'open' : undefined
  }) as Comment | undefined
}

/**
 * Remove what the page rendered in the island's slot outlets under `parent`.
 * Returns `true` when an outlet has no closing comment.
 */
function emptySlotRegions (parent: Node, markers: MarkerSet): boolean {
  const tokenOf = (node: Node): RegionToken => {
    if (node.nodeType !== COMMENT_NODE) { return }
    const data = (node as Comment).data
    if (data === markers.slotEnd) { return 'close' }
    return decodeMarkerComment(data, [markers], undefined)?.kind === 'slot' ? 'open' : undefined
  }
  for (let current = parent.firstChild; current; current = current.nextSibling) {
    // Without a closing comment, slot markup broke out of this parent,
    // so nothing after the outlet belongs to the island.
    const end = tokenOf(current) === 'open' ? findRegionEnd(siblingsAfter(current, null), tokenOf) ?? null : undefined
    if (end === undefined && !emptySlotRegions(current, markers)) { continue }
    while (current.nextSibling !== (end ?? null)) { current.nextSibling!.remove() }
    if (!end) { return true }
    current = end
  }
  return false
}

function findFragmentEnd (start: Node, stop: Node | null): Comment | undefined {
  return findAnchorEnd(start, FRAGMENT_START, FRAGMENT_END, stop)
}

function findAnchorEnd (start: Node, open: string, close: string, stop: Node | null): Comment | undefined {
  return findRegionEnd(siblingsAfter(start, stop), node => anchorToken(node, open, close)) as Comment | undefined
}

function anchorToken (node: Node, open: string, close: string): RegionToken {
  if (node.nodeType !== COMMENT_NODE) { return }
  const data = (node as Comment).data
  return data === open ? 'open' : data === close ? 'close' : undefined
}

function* siblingsAfter (node: Node, stop: Node | null): Generator<ChildNode> {
  for (let current = node.nextSibling; current && current !== stop; current = current.nextSibling) { yield current }
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

/**
 * Build a static run: one Vue `Static` VNode for consecutive DOM nodes without markers, mounted or
 * hydrated as a block. An unchanged run from the previous tree is copied with its live DOM.
 * With `serialize`, each node becomes a `StaticNode` component instead.
 */
function createStaticRun (nodes: Node[], context: WalkContext): VNode[] {
  if (context.serialize) {
    // A unique key makes Vue replace a different node instead of patching it.
    return nodes.map(node => createVNode(StaticNode, { key: ++STATIC_RUN_ID, html: serializeNode(node) }))
  }
  const previous = context.previousRuns ? findPreviousRun(nodes, context.previousRuns) : undefined
  // Dev Vue replaces a static run whose HTML changed, so the old run gets the same HTML.
  if (previous && !previous.children) { previous.children = nodes.map(serializeNode).join('') }
  const vnode: InternalVNode = createStaticVNode((previous?.children as string | undefined) ?? '', nodes.length)
  // A unique key makes Vue replace a different run instead of patching it:
  // production Vue never moves DOM from one Static vnode to another.
  vnode.key = previous?.key ?? ++STATIC_RUN_ID
  // Vue rebuilds a cloned vnode's key from its props, so the key is kept there too.
  vnode.props = { key: vnode.key }
  if (previous) {
    vnode.el = previous.el
    vnode.anchor = previous.anchor
    vnode.memo = []
  } else if (!context.adopt) {
    // With anchors set, Vue clones the parsed nodes at mount instead of parsing the HTML again.
    vnode.el = nodes[0]!
    vnode.anchor = nodes[nodes.length - 1]!
    // A memo keeps Vue from cloning the vnode on re-render
    // production Vue never moves `el` from one Static vnode to another, so a clone would keep pointing at the parsed nodes.
    vnode.memo = []
  }
  return [vnode]
}

function serializeNode (node: Node): string {
  if (node.nodeType === ELEMENT_NODE) { return (node as Element).outerHTML }
  if (node.nodeType === TEXT_NODE) { return escapeHtml((node as Text).data) }
  if (node.nodeType === COMMENT_NODE) { return `<!--${(node as Comment).data}-->` }
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

// Last node of the island starting at `start`, found as Vue's hydration finds it,
// or `undefined` for a fragment without its end.
function rootEnd (start: Node): Node | undefined {
  return isFragmentStart(start) ? findFragmentEnd(start, null) : start
}

function isFragmentStart (node: Node): boolean {
  return node.nodeType === COMMENT_NODE && (node as Comment).data === FRAGMENT_START
}

function isStaticNode (node: Node): boolean {
  return node.nodeType === ELEMENT_NODE || node.nodeType === TEXT_NODE
}

function wrapRoot (vnodes: VNode[]): VNode | undefined {
  if (vnodes.length === 0) { return }
  if (vnodes.length === 1) { return vnodes[0] }
  return createElementVNode(Fragment, null, vnodes)
}

/**
 * HTML of a `.server.vue` half as one plain fragment, shown by the loader until the `.client.vue` half
 * replaces it. `undefined` hydrates the region with the loaded component, as for any other component.
 */
function mountFallback (open: Comment, closing: Comment, tuple: IslandComponentMarker, context: WalkContext): VNode | undefined {
  const start = open.nextSibling
  if (tuple[4] !== 1 || !start || !isFragmentStart(start) || findFragmentEnd(start, closing)?.nextSibling !== closing) { return }
  // Markers inside belong to the server half's HTML; the client half gets its slots from the marker data.
  return walkNode(start, { ...context, markerAncestors: new Set(), plain: true, previousRuns: undefined }, closing).vnodes[0]
}

/**
 * Deep copy of a walk result with no mount state. A static run keeps its `el`: Vue copies that DOM
 * to mount it, and the run may hold no HTML of its own (`serialize` off).
 */
function cloneVNodeTree (vnode: InternalVNode): VNode {
  const clone: InternalVNode = cloneVNode(vnode)
  if (vnode.type === Static) {
    clone.memo = vnode.memo
    return clone
  }
  if (Array.isArray(vnode.children)) { clone.children = (vnode.children as VNode[]).map(cloneVNodeTree) }
  if (vnode.ssContent) { clone.ssContent = cloneVNodeTree(vnode.ssContent) }
  if (vnode.ssFallback) { clone.ssFallback = cloneVNodeTree(vnode.ssFallback) }
  clone.el = clone.anchor = clone.target = clone.targetStart = clone.targetAnchor = null
  clone.component = null
  clone.suspense = null
  return clone
}

function renderClientComponent (data: IslandComponentMarker, options: DomToVNodeOptions, fallback: VNode | undefined): VNode {
  return h(Suspense, null, {
    default: () => h(loader, { data, nonce: options.nonce, nonces: options.nonces, islandSlots: options.slots, remote: options.remote, fallback }),
  })
}
