import type { SSRContext } from 'vue/server-renderer'
// @ts-expect-error ssrUtils is not a public API
import { type App, type ComponentInternalInstance, type DefineComponent, Suspense, type SuspenseBoundary, Text, type VNode, type VNodeChild, type VNodeNormalizedChildren, createApp, createSSRApp, createVNode, defineComponent, h, hasInjectionContext, isVNode, ssrContextKey, ssrUtils, useSSRContext } from 'vue'
import { ShapeFlags, isPromise } from '@vue/shared'
import { ssrRenderComponent } from 'vue/server-renderer'
import { getCurrentInstance, nextTick } from 'vue'

import { type VServerComponent, VServerComponentType } from './shared'
import { createNuxtApp } from '#app/nuxt'

const {
  createComponentInstance,
  setupComponent,
  renderComponentRoot,
}: {
  createComponentInstance: (
    vnode: VNode,
    parent: ComponentInternalInstance | null,
    suspense: SuspenseBoundary | null,
  ) => ComponentInternalInstance
  setupComponent: (
    instance: ComponentInternalInstance,
    isSSR?: boolean,
  ) => Promise<void> | undefined
  renderComponentRoot: (instance: ComponentInternalInstance) => VNode
} = ssrUtils

export async function serializeComponent (component: DefineComponent, props: any, context: SSRContext = {}) {
  const input = createSSRApp(component, props)
  // provide the ssr context to the tree
  input.provide(ssrContextKey, context)

  const vnode = createVNode(input._component, input._props)
  vnode.appContext = input._context

  const instance = createComponentInstance(vnode, input._instance, null)
  const res = await setupComponent(instance, true)
  const hasAsyncSetup = isPromise(res)
  let prefetches = instance.sp as unknown as Promise[]/* LifecycleHooks.SERVER_PREFETCH */

  const child = renderComponentRoot(instance)

  if (hasAsyncSetup || prefetches) {
    const p: Promise<unknown> = Promise.resolve(res)
      .then(() => {
      // instance.sp may be null until an async setup resolves, so evaluate it here
        if (hasAsyncSetup) { prefetches = instance.sp }
        if (prefetches) {
          return Promise.all(
            prefetches.map(prefetch => prefetch.call(instance.proxy)),
          )
        }
      })
    await p.then(() => ssrRenderComponent(instance))
  }
  return renderVNode(child, instance)
}

export async function serializeApp (app: App, context: SSRContext = {}) {
  const input = app
  app.provide(ssrContextKey, context)

  return await app.$nuxt.runWithContext(async () => {
    const vnode = createVNode(input._component, input._props)
    // vnode.appContext = input._context
    const instance = createComponentInstance(vnode, input._instance, null)
    instance.appContext = input._context
    const res = await setupComponent(instance, true)
    const hasAsyncSetup = isPromise(res)
    let prefetches = instance.sp as unknown as Promise[]/* LifecycleHooks.SERVER_PREFETCH */

    const child = renderComponentRoot(instance)

    if (hasAsyncSetup || prefetches) {
      const p: Promise<unknown> = Promise.resolve(res)
        .then(() => {
          // instance.sp may be null until an async setup resolves, so evaluate it here
          if (hasAsyncSetup) { prefetches = instance.sp }
          if (prefetches) {
            return Promise.all(
              prefetches.map(prefetch => prefetch.call(instance.proxy)),
            )
          }
        })
    }
    return renderVNode(child, instance)
  })
}

export async function renderVNode (vnode: VNodeChild, parentInstance?: ComponentInternalInstance): Promise<VServerComponent | undefined> {
  if (isVNode(vnode)) {
    if (vnode.shapeFlag & ShapeFlags.ELEMENT) {
      return {
        type: VServerComponentType.Element,
        tag: vnode.type as string,
        props: vnode.props ?? undefined,
        children: await renderChild(vnode.children || vnode.component?.subTree || vnode.component?.vnode.children, parentInstance),
      }
    } else if (vnode.shapeFlag & ShapeFlags.COMPONENT) {
      const instance = createComponentInstance(vnode, parentInstance ?? null, null)
      const res = await setupComponent(instance, true)
      const hasAsyncSetup = isPromise(res)
      // @ts-expect-error internal API
      let prefetches = instance.sp as unknown as Promise[]/* LifecycleHooks.SERVER_PREFETCH */

      const child = renderComponentRoot(instance)

      if (hasAsyncSetup || prefetches) {
        const p: Promise<unknown> = Promise.resolve(res)
          .then(() => {
            // instance.sp may be null until an async setup resolves, so evaluate it here
            // @ts-expect-error internal API
            if (hasAsyncSetup) { prefetches = instance.sp }
            if (prefetches) {
              return Promise.all(
                prefetches.map(prefetch => prefetch.call(instance.proxy)),
              )
            }
          })
        await p
      }

      if (vnode.props && 'load:client' in vnode.props && vnode.props['load:client'] !== false) {
        // @ts-expect-error
        if (vnode.type.__chunk) {
          return {
            type: VServerComponentType.Component,
            props: vnode.props ?? undefined,
            // @ts-expect-error
            chunk: vnode.type.__chunk as string,
          }
        }
        console.warn('Component is missing chunk information')
        return {
          type: VServerComponentType.Element,
          tag: vnode.type as string,
          props: vnode.props ?? undefined,
          children: await renderChild(vnode.children || vnode.component?.subTree || vnode.component?.vnode.children, parentInstance),
        }
      }
      return {
        type: VServerComponentType.Fragment,
        children: await renderChild(child, parentInstance),
      }
    }
    // handle suspense
    else if (vnode.shapeFlag & ShapeFlags.SUSPENSE) {
      return {
        type: VServerComponentType.Suspense,
        // @ts-expect-error internal API
        children: await renderChild(vnode.ssContent, parentInstance),
      }
    } else if (vnode.type === Text) {
      return {
        type: VServerComponentType.Text,
        text: vnode.children as string,
      }
    }
  } else if (vnode && (typeof vnode === 'string' || typeof vnode === 'number')) {
    return {
      type: VServerComponentType.Text,
      text: vnode as string,
    }
  }
}

async function renderChild (children?: VNodeNormalizedChildren | VNode, parentInstance?: ComponentInternalInstance): Promise<VServerComponent[] | VServerComponent | undefined> {
  if (!children) {
    return
  }

  if (isVNode(children)) {
    return await renderVNode(children, parentInstance)
  }

  if (Array.isArray(children)) {
    return (await Promise.all(children.map(vnode => renderVNode(vnode, parentInstance)))).filter((v): v is VServerComponent => !!v)
  }

  if (typeof children === 'string' || typeof children === 'number') {
    return {
      type: VServerComponentType.Text,
      text: children as string,
    }
  }
}
