import {
  type CallExpression,
  type DirectiveNode,
  type ElementNode,
  ElementTypes,
  type ExpressionNode,
  type JSChildNode,
  type NodeTransform,
  NodeTypes,
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
export type ClientTargetLookup = (file: string, tag: string) => { chunk: string, exportName: string } | undefined

interface PendingBoundary {
  node: ElementNode & { ssrCodegenNode?: CallExpression }
  enabled: ExpressionNode | undefined
  target: ReturnType<ClientTargetLookup>
}

/**
 * Marks a directive as belonging to an SSR compile; survives Vue's clone into the vnode fallback branch.
 */
type TaggedDirective = DirectiveNode & { __islandSsr?: true }

const BOUNDARY_IDENTIFIER = '_islandClientBoundary'
const RENDER_IDENTIFIER = '_islandRenderClient'
const RENDER_VNODE_IDENTIFIER = '_islandRenderClientVNode'
const BOUNDARY_MODULE = '#app/components/islands-v2/server'
const DIRECTIVE_NAME = 'load-client'
/**
 * `enabled`, `chunk` and `exportName` are always emitted so Vue's appended `_scopeId` lands in a fixed position.
 */
const NO_VALUE = 'undefined'

/**
 * Pending wraps per (sub)compilation root.
 */
const PENDING = new WeakMap<RootNode, PendingBoundary[]>()

export function createSsrLoadClientTransform (lookup: ClientTargetLookup): NodeTransform {
  return (node, context) => {
    if (node.type === NodeTypes.ROOT) {
      const pending: PendingBoundary[] = []
      if (context.ssr) { tagSsrDirectives(node.children) }
      PENDING.set(node, pending)
      // Vue sets the codegen node in its own exit hook, which runs before ours; the root exit runs last.
      return () => finishRoot(pending, context)
    }

    if (node.type !== NodeTypes.ELEMENT || node.tagType !== ElementTypes.COMPONENT) { return }
    const index = node.props.findIndex(
      prop => prop.type === NodeTypes.DIRECTIVE && prop.name === DIRECTIVE_NAME,
    )
    if (index === -1) { return }
    const directive = node.props[index] as TaggedDirective
    node.props.splice(index, 1)
    // Vue's slot fallback branch compiles with `ssr: false`; the tag tells it apart from a client build.
    if (!context.ssr && !directive.__islandSsr) { return }
    PENDING.get(context.root)?.push({
      node,
      enabled: directive.exp,
      target: lookup(normalize(context.filename), node.tag),
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
  // The fallback branch shares `imports` with the main pass, so the import is added once.
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

function wrapSsrCall ({ node, enabled, target }: PendingBoundary): boolean {
  const call = node.ssrCodegenNode
  if (!call || call.type !== NodeTypes.JS_CALL_EXPRESSION) { return false }
  const callee = typeof call.callee === 'symbol' ? helperNameMap[call.callee] : call.callee
  const tail = [enabled ?? NO_VALUE, ...targetArgs(target)]
  // `_ssrRenderComponent(comp, props, slots, _parent)` becomes the same-shaped helper call.
  if (callee === 'ssrRenderComponent') {
    call.callee = RENDER_IDENTIFIER
    call.arguments.push(...tail)
    return true
  }
  // `_ssrRenderVNode(_push, _createVNode(comp, props, slots), _parent)` becomes the statement twin.
  if (callee === 'ssrRenderVNode') {
    const [push, vnode] = call.arguments as [string, CallExpression]
    const [component, props = 'null', slots = 'null'] = vnode.arguments
    call.callee = RENDER_VNODE_IDENTIFIER
    call.arguments = [push, component!, props, slots, '_parent', ...tail]
    return true
  }
  return false
}

/**
 * Slot fallback branch: `_createVNode(comp, props, slots, patchFlag, dynamicProps)`.
 */
function wrapVNodeCall ({ node, enabled, target }: PendingBoundary): boolean {
  const call = node.codegenNode as VNodeCall | undefined
  if (!call || call.type !== NodeTypes.VNODE_CALL) { return false }
  call.props = boundaryProps(call.tag as JSChildNode | string, call.props ?? 'null', enabled, target)
  call.tag = BOUNDARY_IDENTIFIER
  call.patchFlag = undefined
  call.dynamicProps = undefined
  return true
}

function targetArgs (target: PendingBoundary['target']): [string, string] {
  return target ? [genString(target.chunk), genString(target.exportName)] : [NO_VALUE, NO_VALUE]
}

function boundaryProps (
  component: JSChildNode | string,
  props: JSChildNode | string,
  enabled: ExpressionNode | undefined,
  target: PendingBoundary['target'],
) {
  const properties = [
    createObjectProperty('is', asNode(component)),
    createObjectProperty('props', asNode(props)),
  ]
  if (enabled) { properties.push(createObjectProperty('enabled', enabled)) }
  if (target) {
    const [chunk, exportName] = targetArgs(target)
    properties.push(
      createObjectProperty('chunk', createSimpleExpression(chunk, false)),
      createObjectProperty('exportName', createSimpleExpression(exportName, false)),
    )
  }
  return createObjectExpression(properties)
}

function asNode (value: JSChildNode | string): JSChildNode {
  return typeof value === 'string' ? createSimpleExpression(value, false) : value
}
