import { reactive, readonly, shallowReactive, toRef } from 'vue'
import { defu } from 'defu';

import { refreshNuxtData, useRoute, useRouter, useState } from '#app'

interface PreviewState {
  enabled: boolean
  state: Record<any, unknown>
  addedAfterNavigationCallback: boolean
}

type GetPreviewStateFunc = (currentState: PreviewState['state']) => Record<any, unknown> | null | undefined | void;
type ShouldEnablePreviewMode = (currentState: PreviewState['state']) => boolean | null | undefined | void;

let shouldEnablePreviewMode: ShouldEnablePreviewMode = () => {
  const route = useRoute();
  const previewQueryName = 'preview'

  return route.query[previewQueryName] === 'true'
}

export function usePreviewMode<Controls extends boolean = false, GetPreviewState extends GetPreviewStateFunc = GetPreviewStateFunc> (options?: {
  controls?: Controls,
  getPreviewState?: GetPreviewState
  shouldEnablePreviewMode?: ShouldEnablePreviewMode;
}) {
  const normalizedOptions = defu(options, {
    controls: false,
    getPreviewState: (state: PreviewState['state']) => {
      const route = useRoute()
      const token = state.token 
        ?? (Array.isArray(route.query.token) ? route.query.token[0] : route.query.token);

      return { token: token as string } as PreviewState['state']
    },
  })

  const router = useRouter()

  const previewState = useState('_preview-composable', () => shallowReactive<PreviewState>({
    enabled: false,
    state: reactive({}),
    addedAfterNavigationCallback: false,
  }))

  if (normalizedOptions.shouldEnablePreviewMode) {
    shouldEnablePreviewMode = normalizedOptions.shouldEnablePreviewMode
  }
  
  if (!previewState.value.enabled) {
    const result = shouldEnablePreviewMode(previewState.value.state);

    if (typeof result === 'boolean')
      previewState.value.enabled = result
  }

  if (previewState.value.enabled) {
    const newState = normalizedOptions.getPreviewState(previewState.value.state)

    if (newState) {
      Object.assign(previewState.value.state, newState)
    }
  }

  const refreshData = () => {
    previewState.value.addedAfterNavigationCallback = true
    refreshNuxtData()
  }

  if (previewState.value.enabled && !previewState.value.addedAfterNavigationCallback && process.client) {
    refreshData()
    router.afterEach(refreshData)
  }

  const enabled = readonly(toRef(previewState.value, 'enabled'))
  const state = previewState.value.state as NonNullable<ReturnType<GetPreviewState>>

  return (normalizedOptions.controls
    ? { enabled, state }
    : enabled) as Controls extends true ? { enabled: typeof enabled, state: typeof state } : typeof enabled
}
