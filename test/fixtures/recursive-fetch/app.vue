<script setup lang="ts">
interface FetchErrorLike {
  response?: {
    status?: number
    statusText?: string
  }
  status?: number
  statusText?: string
  message?: string
  data?: unknown
}

const result = useState('recursive-fetch-result', () => 'not run')

function getErrorMessage (error: FetchErrorLike) {
  if (typeof error.data === 'object' && error.data && 'message' in error.data) {
    return String(error.data.message)
  }
  if (typeof error.data === 'string') {
    if (error.data.includes('Loop detected')) {
      return `Loop detected while rendering${error.data.includes('recursive-fetch-target') ? ' /recursive-fetch-target' : ''}`
    }
    return error.data
  }
  return error.response?.statusText || error.statusText || error.message || 'unknown error'
}

if (import.meta.server) {
  const url = useRequestURL()

  if (url.pathname === '/') {
    const apiResult = await $fetch('/api/ping')

    try {
      await $fetch('/recursive-fetch-target')
      result.value = `api: ${apiResult}; recursive fetch unexpectedly succeeded`
    } catch (error) {
      const fetchError = error as FetchErrorLike
      const status = fetchError.response?.status || fetchError.status || 'unknown'
      result.value = `api: ${apiResult}; recursive fetch status: ${status}; ${getErrorMessage(fetchError)}`
    }
  } else if (url.pathname === '/recursive-fetch-target') {
    await $fetch('/recursive-fetch-target')
    result.value = 'recursive target unexpectedly rendered'
  }
}
</script>

<template>
  <div>{{ result }}</div>
</template>
