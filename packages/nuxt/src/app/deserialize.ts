import { createTextVNode, type VNode, h, Fragment, Suspense } from "vue";
import { VServerComponentType, type VServerComponent } from "./shared";
import loader from "./components/loader";


export function renderServerComponent(input?: VServerComponent): VNode | undefined {
    if (!input) return;
    if (input.type === VServerComponentType.Text) {
        return createTextVNode(input.text)
    }
    if (input.type === VServerComponentType.Element) {
        return h(input.tag, input.props, Array.isArray(input.children) ? input.children.map(renderServerComponent) : renderServerComponent(input.children))
    }
    if(input.type === VServerComponentType.Component) {
        return h(Suspense, {}, {
            default: () => h(loader, {
                data: input
            })
        })
    }
    if (input.type === VServerComponentType.Fragment) {
        return Array.isArray(input.children) ? h(Fragment, input.children.map(renderServerComponent)) : renderServerComponent(input.children)
    }
}


export function renderChildren(data: VServerComponent | VServerComponent[] | undefined): VNode | undefined {
    if (!data) return;
    if (Array.isArray(data)) {
        return h(Fragment, data.map(renderServerComponent))
    } else {
        return renderServerComponent(data)
    }
}