import type { ComponentInternalInstance, VNode } from 'vue'
import { ssrRenderVNode } from 'vue/server-renderer'
import { isArray, isPromise, isString } from '@vue/shared'

export type SSRBuffer = SSRBufferItem[] & { hasAsync?: boolean }
export type SSRBufferItem = string | SSRBuffer | Promise<SSRBuffer>

/**
 * create buffer retrieved from @vue/server-renderer
 * @see https://github.com/vuejs/core/blob/9617dd4b2abc07a5dc40de6e5b759e851b4d0da1/packages/server-renderer/src/render.ts#L57
 * @private
 */
export function createBuffer (): { getBuffer: () => SSRBuffer, push: (item: SSRBufferItem) => void } {
  let appendable = false
  const buffer: SSRBuffer = []
  return {
    getBuffer (): SSRBuffer {
      return buffer
    },
    push (item: SSRBufferItem) {
      const isStringItem = isString(item)
      if (appendable && isStringItem) {
        buffer[buffer.length - 1] += item as string
      } else {
        buffer.push(item)
      }
      appendable = isStringItem
      if (isPromise(item) || (isArray(item) && item.hasAsync)) {
        buffer.hasAsync = true
      }
    },
  }
}

/**
 * Wait for every async component in an SSR buffer, including those nested inside other async components.
 * Rejects with the first error once every item has settled.
 * @private
 */
export async function settleBuffer (buffer: SSRBuffer): Promise<void> {
  const results = await Promise.allSettled(buffer.map((item) => {
    if (isPromise(item)) {
      return item.then(settleBuffer)
    }
    if (isArray(item) && item.hasAsync) {
      return settleBuffer(item)
    }
  }))
  const failure = results.find(result => result.status === 'rejected')
  if (failure) {
    throw failure.reason
  }
}

/**
 * Render vnodes to an SSR buffer and wait for it to settle, so that any error they throw reaches the
 * caller's `onErrorCaptured` hook (or this function's rejection) before the caller's `ssrRender` runs.
 * The caller is expected to push the returned buffer from a custom `ssrRender`.
 * @private
 */
export async function ssrRenderSlotToBuffer (vm: ComponentInternalInstance, vnodes: VNode[] | undefined): Promise<SSRBuffer> {
  const ssrVNodes = createBuffer()

  if (vnodes) {
    for (let i = 0; i < vnodes.length; i++) {
      ssrRenderVNode(ssrVNodes.push, vnodes[i]!, vm)
    }
  }

  const buffer = ssrVNodes.getBuffer()
  if (buffer.hasAsync) {
    await settleBuffer(buffer)
  }

  return buffer
}
