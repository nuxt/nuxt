import { computed, reactive, ref } from 'vue'
import { defu } from 'defu'

import { refreshNuxtData, useRoute, useRouter, useState } from '#app'

interface Preview {
  state: Record<any, unknown>
}

type GetStateFunc = (currentState: Preview['state']) => Record<any, unknown> | null | undefined | void;
type ShouldEnableFunc = (currentState: Preview['state']) => boolean | null | undefined | void;

let shouldEnablePreviewMode: ShouldEnableFunc = () => {
  const route = useRoute()
  const previewQueryName = 'preview'

  return route.query[previewQueryName] === 'true'
}

let unregisterRefreshHook: () => any
const _previewEnabled = ref(false)
const previewEnabled = computed({
  get () { return _previewEnabled.value },
  set (value: boolean) {
    if (value === _previewEnabled.value) { return }

    _previewEnabled.value = value

    if (value && !unregisterRefreshHook) {
      refreshNuxtData()

      unregisterRefreshHook = useRouter().afterEach(() => { refreshNuxtData() })
    } else if (!value && unregisterRefreshHook) {
      unregisterRefreshHook()
    }
  }
})

export function usePreviewMode<Controls extends boolean = false, GetPreviewState extends GetStateFunc = GetStateFunc> (options?: {
  controls?: Controls,
  getState?: GetPreviewState
  shouldEnable?: ShouldEnableFunc;
}) {
  const normalizedOptions = defu(options, {
    controls: false,
    getState: (state: Preview['state']) => {
      const route = useRoute()
      const token = state.token ??
        (Array.isArray(route.query.token) ? route.query.token[0] : route.query.token)

      return { token: token as string } as Preview['state']
    }
  })

  const preview = useState('_preview-composable', () => reactive<Preview>({
    state: {}
  }))

  // Because of how vue works we can not know ahead of time whether
  // some components down the tree have `shouldEnable` function. So
  // most upper call `usePreviewMode` with `shouldEnable` will be executed first.
  if (normalizedOptions.shouldEnable) {
    shouldEnablePreviewMode = normalizedOptions.shouldEnable
  }

  if (!previewEnabled.value) {
    const result = shouldEnablePreviewMode(preview.value.state)

    if (typeof result === 'boolean') { previewEnabled.value = result }
  }

  if (previewEnabled.value) {
    const newState = normalizedOptions.getState(preview.value.state)

    if (newState) {
      Object.assign(preview.value.state, newState)
    }
  }

  const enabled = previewEnabled
  const state = preview.value.state as NonNullable<ReturnType<GetPreviewState>>

  return (normalizedOptions.controls
    ? { enabled, state }
    : enabled) as Controls extends true ? { enabled: typeof enabled, state: typeof state } : typeof enabled
}
