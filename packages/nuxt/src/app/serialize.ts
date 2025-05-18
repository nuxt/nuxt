// @ts-expect-error ssrUtils is not a public API
import { createVNode, isVNode, type App, type VNode, type VNodeChild, type VNodeNormalizedChildren, ssrUtils, type ComponentInternalInstance, type SuspenseBoundary} from "vue";
import { ShapeFlags } from "@vue/shared";
import { VServerComponentType, type VServerComponent } from "./shared";
import type { SSRContext } from "vue/server-renderer";

const {
	createComponentInstance,
	setupComponent,
	renderComponentRoot,
}: {
	createComponentInstance: (
		vnode: VNode,
		parent: ComponentInternalInstance | null,
		suspense: SuspenseBoundary | null,
	) => ComponentInternalInstance;
	setupComponent: (
		instance: ComponentInternalInstance,
		isSSR?: boolean,
	) => Promise<void> | undefined;
	renderComponentRoot: (instance: ComponentInternalInstance) => VNode;
} = ssrUtils;

export async function renderToAST(input: App, context: SSRContext) {
    const vnode = createVNode(input._component, input._props)
    vnode.appContext = input._context

			const instance = createComponentInstance(vnode, null, null);
			await setupComponent(instance, true);
			const child = renderComponentRoot(instance);

    return renderVNode(child)
}


export async function renderVNode(vnode: VNodeChild): Promise<VServerComponent | undefined> {
    if (isVNode(vnode)) {
        if (vnode.shapeFlag & ShapeFlags.ELEMENT) {
            return {
                type: VServerComponentType.Element,
                tag: vnode.type as string,
                props: vnode.props ?? undefined,
                children: await renderChild(vnode.children || vnode.component?.subTree || vnode.component?.vnode.children),
            }
        } else if (vnode.shapeFlag & ShapeFlags.COMPONENT) {
            if(vnode.props && 'load:client' in vnode.props && vnode.props['load:client'] !== false) {

                return {
                    type: VServerComponentType.Component,
                    props: vnode.props ?? undefined,
                    children: await renderChild(vnode.children || vnode.component?.subTree || vnode.component?.vnode.children),
                    chunk: vnode.type.__chunk as string
                }
            }
            return {
                type: VServerComponentType.Fragment,
                children: await renderChild(vnode.children || vnode.component?.subTree || vnode.component?.vnode.children),
            }
        }
        // handle suspense
    } else if (typeof vnode === "string" || typeof vnode === "number") {
        return {
            type: VServerComponentType.Text,
            text: vnode as string
        }
    }
}

async function renderChild(children?: VNodeNormalizedChildren | VNode): Promise<VServerComponent[] | VServerComponent | undefined> {
    if (!children) {
        return
    }

    if (isVNode(children)) {
        return renderVNode(children)
    }

    if (Array.isArray(children)) {
        return (await Promise.all(children.map(renderVNode))).filter((v): v is VServerComponent => !!v)
    }

    if (typeof children === "string" || typeof children === "number") {
        return {
            type: VServerComponentType.Text,
            text: children as string
        }
    }
}

