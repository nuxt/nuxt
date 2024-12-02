import type { AsyncDataOptions, UseFetchOptions } from 'nuxt/app'
import type { NitroFetchRequest } from 'nitro/types'

interface CustomError {
  code: string
  message: string
}
export function useFetchCustom<T, E = CustomError> (
  url: NitroFetchRequest,
  options?: UseFetchOptions<T>,
) {
  return useFetch<T, E>(url, {
    ...options,
    $fetch: useNuxtApp().$customFetch as typeof $fetch,
  })
}

export function useAsyncFetchCustom<T, E = CustomError> (
  url: NitroFetchRequest,
  options?: AsyncDataOptions<T>,
) {
  return useAsyncData<T, E>(() => $fetch(url as string), {
    ...options,
  })
}
