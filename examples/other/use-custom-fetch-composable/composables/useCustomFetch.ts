import type { UseFetchOptions } from 'nuxt/app'

export async function useCustomFetch<T> (url: string, options: UseFetchOptions<T> = {}) {
  const userAuth = useCookie('token')
  const config = useRuntimeConfig()

  const defaults: UseFetchOptions<T> = {
    baseURL: config.baseUrl ?? 'https://api.nuxtjs.dev',
    // cache request
    key: url,

    onRequest ({ options }) {
      options.headers = options.headers ?? new Headers()

      // set user token if connected
      if (userAuth.value) {
        options.headers.Authorization = `Bearer ${userAuth.value}`
      }
    },

    onResponse (__ctx) {
      // return new myBusinessResponse(response._data)
    },

    onResponseError (__ctx) {
      // return new myBusinessError(error)
    }
  }

  // for nice deep defaults, please use unjs/defu
  const params = Object.assign(defaults, options)

  return await useFetch(url, params)
}
