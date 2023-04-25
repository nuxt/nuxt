import type { UseFetchOptions } from 'nuxt/app'
import { defu } from 'defu'

export async function useCustomFetch<T> (url: string, options: UseFetchOptions<T> = {}) {
  const userAuth = useCookie('token')
  const config = useRuntimeConfig()

  const defaults: UseFetchOptions<T> = {
    baseURL: config.baseUrl ?? 'https://api.nuxtjs.dev',
    // cache request
    key: url,

    headers: new Headers(
      userAuth.value // set user token if connected
        ? { Authorization: `Bearer ${userAuth.value}` }
        : {}
    ),

    onResponse (__ctx) {
      // return new myBusinessResponse(response._data)
    },

    onResponseError (__ctx) {
      // return new myBusinessError(error)
    }
  }

  // for nice deep defaults, please use unjs/defu
  const params = defu(defaults, options)

  return await useFetch(url, params)
}
