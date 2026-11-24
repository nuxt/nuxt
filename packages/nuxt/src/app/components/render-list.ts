import { renderList as _renderList } from 'vue'
import { ssrRenderList as _ssrRenderList } from 'vue/server-renderer'
import { tryUseNuxtApp } from '../nuxt'
import { MAX_VFOR_LENGTH, vforBound } from './vfor'

function bound<T> (source: T): T | number {
  if (typeof source === 'number' && source > MAX_VFOR_LENGTH && tryUseNuxtApp()?.ssrContext?.islandContext) {
    return vforBound(source)
  }
  return source
}

/**
 * `renderList` from `vue`, with numeric sources clamped to `MAX_VFOR_LENGTH`
 * while rendering a server component or island.
 *
 * @internal
 */
export const renderList = ((source: unknown, ...rest: unknown[]) => (_renderList as (...args: unknown[]) => unknown)(bound(source), ...rest)) as typeof _renderList

/**
 * `ssrRenderList` from `vue/server-renderer`, with numeric sources clamped to
 * `MAX_VFOR_LENGTH` while rendering a server component or island.
 *
 * @internal
 */
export function ssrRenderList (source: unknown, renderItem: Parameters<typeof _ssrRenderList>[1]): void {
  _ssrRenderList(bound(source), renderItem)
}
