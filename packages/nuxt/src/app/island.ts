import type { SSRContext, } from "vue/server-renderer"
import type { App, DefineComponent, VNode } from "vue"
import { isVNode, createApp, Suspense, } from "vue"
import { renderToString } from "vue/server-renderer"
import { renderToAST } from "./serialize"
import { h } from "vue"

export async function renderIsland(_component: DefineComponent, props: any,
  context: SSRContext = {},) {
    const component = _component.__vnodeVersion ? await import(_component.__vnodeVersion).then(m => m.default || m) : _component
  const app = createApp(() => h(component, props))
  return await renderToAST(app, context)
}

export async function renderAsServerComponent(
  input: App | VNode,
  context: SSRContext = {},
  props?: any
): Promise<{
  html: string,
  ast: any
}> {

  if (isVNode(input)) {
    // raw vnode, wrap with app (for context)
    return renderAsServerComponent(createApp({ render: () => input }), context)
  }


  if(!input.version) {
    // raw compponent
    return renderAsServerComponent(createApp(input, props), context)
  }
  const htmlPromise = renderToString(input, context)
  const astPromise = renderToAST(input, context)
  const [html, ast] = await Promise.all([htmlPromise, astPromise])

  return {
    html, ast
  }
}
