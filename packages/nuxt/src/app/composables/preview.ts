import { reactive, readonly, toRef, toRefs } from 'vue'

import { refreshNuxtData, useRoute, useRouter } from '#app'

export interface PreviewOptions {
  controls: boolean
  tokenQueryName: string
}

interface PreviewState {
  enabled: boolean
  token: string | null
}

const previewQueryName = 'preview'
const previewDefaultOptions: PreviewOptions = {
  controls: false,
  tokenQueryName: 'token'
}

const tokensMap = new Map<string, string | null>()

let isPreviewEnabled: boolean
let addedAfterNavigationCallback = false

export function usePreviewMode (options?: PreviewOptions) {
  options = { ...previewDefaultOptions, ...(options || {}) }

  const preview = reactive<PreviewState>({
    enabled: false,
    token: null
  })

  const router = useRouter()
  const route = useRoute()

  const previewParam = route.query[previewQueryName]

  preview.enabled = isPreviewEnabled ?? (!!previewParam && previewParam === 'true')

  isPreviewEnabled = preview.enabled

  if (preview.enabled && !tokensMap.get(options!.tokenQueryName)) {
    const query = route.query[options!.tokenQueryName]
    const token = Array.isArray(query) ? query[0] : query

    tokensMap.set(options!.tokenQueryName, token)
  }

  preview.token = tokensMap.get(options!.tokenQueryName) || null

  const refreshData = () => {
    addedAfterNavigationCallback = true
    refreshNuxtData()
  }

  if (preview.enabled && !addedAfterNavigationCallback && process.client) {
    refreshData()
    router.afterEach(refreshData)
  }

  return options.controls
    ? toRefs(readonly(preview))
    : readonly(toRef(preview, 'enabled'))
}
