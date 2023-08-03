import { reactive, readonly, toRef } from 'vue'
import { defu } from 'defu';

import { refreshNuxtData, useRoute, useRouter, useState } from '#app'

interface Preview {
  enabled: boolean
  state: Record<any, unknown>
  addedAfterNavigationCallback: boolean
}

type GetStateFunc = (currentState: Preview['state']) => Record<any, unknown> | null | undefined | void;
type ShouldEnableFunc = (currentState: Preview['state']) => boolean | null | undefined | void;

let shouldEnablePreviewMode: ShouldEnableFunc = () => {
  const route = useRoute();
  const previewQueryName = 'preview'

  return route.query[previewQueryName] === 'true'
}

export function usePreviewMode<Controls extends boolean = false, GetPreviewState extends GetStateFunc = GetStateFunc> (options?: {
  controls?: Controls,
  getState?: GetPreviewState
  shouldEnable?: ShouldEnableFunc;
}) {
  const normalizedOptions = defu(options, {
    controls: false,
    getState: (state: Preview['state']) => {
      const route = useRoute()
      const token = state.token 
        ?? (Array.isArray(route.query.token) ? route.query.token[0] : route.query.token);

      return { token: token as string } as Preview['state']
    },
  })

  const router = useRouter()

  const preview = useState('_preview-composable', () => reactive<Preview>({
    enabled: false,
    state: {},
    addedAfterNavigationCallback: false,
  }))

  // Because of how vue works we can not know ahead of time whether
  // some components down the tree have `shouldEnable` function. So
  // most upper call `usePreviewMode` with `shouldEnable` will be executed.
  if (normalizedOptions.shouldEnable) {
    shouldEnablePreviewMode = normalizedOptions.shouldEnable
  }
  
  if (!preview.value.enabled) {
    const result = shouldEnablePreviewMode(preview.value.state);

    if (typeof result === 'boolean')
      preview.value.enabled = result
  }

  if (preview.value.enabled) {
    const newState = normalizedOptions.getState(preview.value.state)

    if (newState) {
      Object.assign(preview.value.state, newState)
    }
  }

  const refreshData = () => {
    preview.value.addedAfterNavigationCallback = true
    refreshNuxtData()
  }

  if (preview.value.enabled && !preview.value.addedAfterNavigationCallback && process.client) {
    refreshData()
    router.afterEach(refreshData)
  }

  const enabled = readonly(toRef(preview.value, 'enabled'))
  const state = preview.value.state as NonNullable<ReturnType<GetPreviewState>>

  return (normalizedOptions.controls
    ? { enabled, state }
    : enabled) as Controls extends true ? { enabled: typeof enabled, state: typeof state } : typeof enabled
}
