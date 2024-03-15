import { toRef, watch } from 'vue'

import { useState } from './state'
import { refreshNuxtData } from './asyncData'
import { useRoute, useRouter } from './router'

interface Preview {
  enabled: boolean
  state: Record<any, unknown>
  _initialized?: boolean
}

interface PreviewModeOptions<S> {
  shouldEnable?: (state: Preview['state']) => boolean,
  getState?: (state: Preview['state']) => S,
}

type EnteredState = Record<any, unknown> | null | undefined | void

let unregisterRefreshHook: (() => any) | undefined

/** @since 3.11.0 */
export function usePreviewMode<S extends EnteredState> (options: PreviewModeOptions<S> = {}) {
  const preview = useState<Preview>('_preview-state', () => ({
    enabled: false,
    state: {}
  }))

  if (preview.value._initialized) {
    return {
      enabled: toRef(preview.value, 'enabled'),
      state: preview.value.state as S extends void ? Preview['state'] : (NonNullable<S> & Preview['state'])
    }
  }

  if (import.meta.client) {
    preview.value._initialized = true
  }

  if (!preview.value.enabled) {
    const shouldEnable = options.shouldEnable ?? defaultShouldEnable
    const result = shouldEnable(preview.value.state)

    if (typeof result === 'boolean') { preview.value.enabled = result }
  }

  watch(() => preview.value.enabled, (value) => {
    if (value) {
      const getState = options.getState ?? getDefaultState
      const newState = getState(preview.value.state)

      if (newState !== preview.value.state) {
        Object.assign(preview.value.state, newState)
      }

      if (import.meta.client && !unregisterRefreshHook) {
        refreshNuxtData()

        unregisterRefreshHook = useRouter().afterEach(() => refreshNuxtData())
      }
    } else if (unregisterRefreshHook) {
      unregisterRefreshHook()

      unregisterRefreshHook = undefined
    }
  }, { immediate: true, flush: 'sync' })

  return {
    enabled: toRef(preview.value, 'enabled'),
    state: preview.value.state as S extends void ? Preview['state'] : (NonNullable<S> & Preview['state'])
  }
}

function defaultShouldEnable () {
  const route = useRoute()
  const previewQueryName = 'preview'

  return route.query[previewQueryName] === 'true'
}

function getDefaultState (state: Preview['state']) {
  if (state.token !== undefined) {
    return state
  }

  const route = useRoute()

  state.token = Array.isArray(route.query.token) ? route.query.token[0] : route.query.token

  return state
}
