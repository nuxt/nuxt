import {
  type CallExpression,
  type DirectiveNode,
  type ElementNode,
  ElementTypes,
  type ExpressionNode,
  type JSChildNode,
  type NodeTransform,
  NodeTypes,
  type Property,
  type RootNode,
  type TemplateChildNode,
  type TransformContext,
  type VNodeCall,
  createObjectExpression,
  createObjectProperty,
  createSimpleExpression,
  helperNameMap,
} from '@vue/compiler-dom'
import { genString } from 'knitwork'
import { normalize } from 'pathe'

/**
 * Client chunk a `v-load-client` tag of `file` loads, `undefined` when the scan found none.
 */
export type ClientTargetLookup = (file: string, tag: string) => { chunk: string, exportName: string, mount?: boolean } | undefined

/**
 * A `v-load-client` component whose render call is rewritten once the compile root exits.
 */
interface PendingBoundary {
  node: ElementNode & { ssrCodegenNode?: CallExpression }
  enabled: ExpressionNode | undefined
  target: ReturnType<ClientTargetLookup>
  /**
   * Whether the directive has the `.slots` modifier, e.g. `<Foo v-load-client.slots />`, which also
   * sends the client the slots the component does not render on the server.
   */
  allSlots: boolean
}

/**
 * Directive marked as found in an SSR compile. The mark survives Vue's copy of slot content into
 * the vnode branch of compiled slots, which compiles with `ssr: false`.
 */
type TaggedDirective = DirectiveNode & { __islandSsr?: true }

const BOUNDARY_IDENTIFIER = '_islandClientBoundary'
const RENDER_IDENTIFIER = '_islandRenderClient'
const RENDER_VNODE_IDENTIFIER = '_islandRenderClientVNode'
const BOUNDARY_MODULE = '#app/components/islands-v2/server'
const DIRECTIVE_NAME = 'load-client'
const ALL_SLOTS_MODIFIER = 'slots'

/**
 * Pending `v-load-client` components of each compile root; a slot's vnode branch has its own root.
 */
const PENDING = new WeakMap<RootNode, PendingBoundary[]>()

/**
 * Node transform that rewrites the SSR render call of each `v-load-client` component,
 * e.g. `<Counter v-load-client />`, into the islands helpers with its scanned chunk.
 */
export function createSsrLoadClientTransform (lookup: ClientTargetLookup): NodeTransform {
  return (node, context) => {
    if (node.type === NodeTypes.ROOT) {
      const pending: PendingBoundary[] = []
      if (context.ssr) { tagSsrDirectives(node.children) }
      PENDING.set(node, pending)
      // Vue sets each element's codegen node in its exit hook, which runs before ours,
      // so the calls are rewritten when the root exits, last.
      return () => finishRoot(pending, context)
    }

    if (node.type !== NodeTypes.ELEMENT || node.tagType !== ElementTypes.COMPONENT) { return }
    const index = node.props.findIndex(
      prop => prop.type === NodeTypes.DIRECTIVE && prop.name === DIRECTIVE_NAME,
    )
    if (index === -1) { return }
    const directive = node.props[index] as TaggedDirective
    node.props.splice(index, 1)
    // A slot's vnode branch compiles with `ssr: false`; the mark tells it apart from a client build.
    if (!context.ssr && !directive.__islandSsr) { return }
    PENDING.get(context.root)?.push({
      node,
      enabled: directive.exp,
      target: lookup(normalize(context.filename), node.tag),
      allSlots: directive.modifiers.some(modifier => modifier.content === ALL_SLOTS_MODIFIER),
    })
  }
}

function tagSsrDirectives (children: TemplateChildNode[]): void {
  for (const child of children) {
    if (child.type !== NodeTypes.ELEMENT) { continue }
    for (const prop of child.props) {
      if (prop.type === NodeTypes.DIRECTIVE && prop.name === DIRECTIVE_NAME) {
        (prop as TaggedDirective).__islandSsr = true
      }
    }
    tagSsrDirectives(child.children)
  }
}

function finishRoot (pending: PendingBoundary[], context: TransformContext): void {
  let used = false
  for (const entry of pending) {
    used = (context.ssr ? wrapSsrCall(entry) : wrapVNodeCall(entry)) || used
  }
  // The vnode branch shares `imports` with the SSR pass, so the import is added only once.
  if (used && !context.imports.some(item => item.path === BOUNDARY_MODULE)) {
    context.imports.push({
      exp: createSimpleExpression(
        `{ IslandClientBoundary as ${BOUNDARY_IDENTIFIER}, ssrRenderClientComponent as ${RENDER_IDENTIFIER}, ` +
          `ssrRenderClientVNode as ${RENDER_VNODE_IDENTIFIER} }`,
        false,
      ),
      path: BOUNDARY_MODULE,
    })
  }
}

function wrapSsrCall (entry: PendingBoundary): boolean {
  const call = entry.node.ssrCodegenNode
  if (!call || call.type !== NodeTypes.JS_CALL_EXPRESSION) { return false }
  const callee = typeof call.callee === 'symbol' ? helperNameMap[call.callee] : call.callee
  const options = createObjectExpression(boundaryOptions(entry))
  // `_ssrRenderComponent(comp, props, slots, _parent)` becomes the helper call plus its options.
  if (callee === 'ssrRenderComponent') {
    call.callee = RENDER_IDENTIFIER
    call.arguments.push(options)
    return true
  }
  // `_ssrRenderVNode(_push, _createVNode(comp, props, slots), _parent)` becomes
  // `_islandRenderClientVNode(_push, comp, props, slots, _parent, options)`.
  if (callee === 'ssrRenderVNode') {
    const [push, vnode] = call.arguments as [string, CallExpression]
    const [component, props = 'null', slots = 'null'] = vnode.arguments
    call.callee = RENDER_VNODE_IDENTIFIER
    call.arguments = [push, component!, props, slots, '_parent', options]
    return true
  }
  return false
}

/**
 * Vnode branch of a slot: `_createVNode(comp, props, slots, patchFlag, dynamicProps)` becomes
 * `_createVNode(_islandClientBoundary, { is: comp, props, ...options }, slots)`.
 */
function wrapVNodeCall (entry: PendingBoundary): boolean {
  const call = entry.node.codegenNode as VNodeCall | undefined
  if (!call || call.type !== NodeTypes.VNODE_CALL) { return false }
  call.props = createObjectExpression([
    createObjectProperty('is', asNode(call.tag as JSChildNode | string)),
    createObjectProperty('props', asNode(call.props ?? 'null')),
    ...boundaryOptions(entry),
  ])
  call.tag = BOUNDARY_IDENTIFIER
  call.patchFlag = undefined
  call.dynamicProps = undefined
  return true
}

/**
 * `enabled`, `chunk`, `exportName`, `mount` and `allSlots` properties, each only when present.
 */
function boundaryOptions ({ enabled, target, allSlots }: PendingBoundary): Property[] {
  const properties: Property[] = []
  if (enabled) { properties.push(createObjectProperty('enabled', enabled)) }
  if (target) {
    properties.push(
      createObjectProperty('chunk', createSimpleExpression(genString(target.chunk), false)),
      createObjectProperty('exportName', createSimpleExpression(genString(target.exportName), false)),
    )
    if (target.mount) { properties.push(createObjectProperty('mount', createSimpleExpression('true', false))) }
    if (allSlots) { properties.push(createObjectProperty('allSlots', createSimpleExpression('true', false))) }
  }
  return properties
}

function asNode (value: JSChildNode | string): JSChildNode {
  return typeof value === 'string' ? createSimpleExpression(value, false) : value
}
