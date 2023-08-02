import { reactive, readonly, toRef } from 'vue'

import { refreshNuxtData, useRoute, useRouter, useState } from '#app'

export interface PreviewOptions<Controls extends boolean = false> {
  controls?: Controls
  tokenQueryName?: string
}

interface PreviewState {
  enabled: boolean
  token: string | null
  addedAfterNavigationCallback: boolean
}

const previewQueryName = 'preview'

export function usePreviewMode<Controls extends boolean = false> (options?: PreviewOptions<Controls>) {
  options = {
    controls: false as Controls,
    tokenQueryName: 'token',
    ...(options || {})
  }

  const router = useRouter()
  const route = useRoute()

  const previewState = useState('_preview-composable', () => reactive<PreviewState>({
    enabled: false,
    token: null,
    addedAfterNavigationCallback: false
  }))

  if (!previewState.value.enabled) {
    const previewParam = route.query[previewQueryName]

    previewState.value.enabled = previewParam === 'true'

    if (previewState.value.enabled && !previewState.value.token) {
      const query = route.query[options!.tokenQueryName!]
      const token = Array.isArray(query) ? query[0] : query

      if (token) {
        previewState.value.token = token
      }
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
  const token = readonly(toRef(previewState.value, 'token'))

  return (options.controls
    ? { enabled, token }
    : enabled) as Controls extends true ? { enabled: typeof enabled, token: typeof token } : typeof enabled
}
