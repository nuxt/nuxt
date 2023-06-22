import { readonly, ref } from 'vue'
import type { Ref } from 'vue'

import { refreshNuxtData, useRoute, useRouter } from '#app'

export interface PreviewOptions {
  controls: boolean
  tokenQueryName: string
}

const previewQueryName = 'preview'
const previewDefaultOptions: PreviewOptions = {
  controls: false,
  tokenQueryName: 'token'
}

const tokensMap = new Map<string, string | null>()

let _isPreview: Ref<boolean>
let addedAfterNavigationCallback = false

export function usePreviewMode (options?: PreviewOptions) {
  options = { ...previewDefaultOptions, ...(options || {}) }

  const router = useRouter()
  const route = useRoute()

  const previewParam = route.query[previewQueryName]

  const isPreview = _isPreview || ref<boolean>(!!previewParam && previewParam === 'true')
  _isPreview = isPreview

  const tokenFromMap = tokensMap.get(options!.tokenQueryName)

  if (!isPreview.value || !tokenFromMap) {
    const query = route.query[options!.tokenQueryName]
    const token = Array.isArray(query) ? query[0] : query

    tokensMap.set(options!.tokenQueryName, token)
  }

  const token = readonly(ref<string | null>(tokenFromMap || null))

  const refreshData = () => {
    addedAfterNavigationCallback = true
    refreshNuxtData()
  }

  if (isPreview.value && !addedAfterNavigationCallback && process.client) {
    refreshData()
    router.afterEach(refreshData)
  }

  if (options.controls) { return { isPreview, token } }

  return isPreview
}
