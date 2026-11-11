import {
  type CallExpression,
  type ElementNode,
  ElementTypes,
  type FunctionExpression,
  type NodeTransform,
  NodeTypes,
  helperNameMap,
} from '@vue/compiler-dom'

/**
 * Gives the fallback closure of each SSR `ssrRenderSlot` call a `_push` parameter, so the islands
 * `ssrRenderSlot` can render a fallback into a buffer of its own instead of the template's stream.
 */
export const ssrSlotFallbackTransform: NodeTransform = (node, context) => {
  if (!context.ssr || node.type !== NodeTypes.ELEMENT || node.tagType !== ElementTypes.SLOT || node.children.length === 0) { return }
  // Vue's own transform has set the call already; `ssrRenderSlotInner` (inside `<Transition>`) stays Vue's.
  const call = (node as ElementNode & { ssrCodegenNode?: CallExpression }).ssrCodegenNode
  if (!call || typeof call.callee !== 'symbol' || helperNameMap[call.callee] !== 'ssrRenderSlot') { return }
  // Vue builds the closure `() => { _push(...) }` at codegen, after every node transform, and stores it
  // as the fourth argument; the setter adds the parameter then.
  let fallback = call.arguments[3]
  Object.defineProperty(call.arguments, 3, {
    configurable: true,
    enumerable: true,
    get: () => fallback,
    set (value: typeof fallback) {
      if ((value as { type?: NodeTypes }).type === NodeTypes.JS_FUNCTION_EXPRESSION) { (value as FunctionExpression).params = ['_push'] }
      fallback = value
    },
  })
}
