import type { FetchOptions } from 'ofetch'
type method = 'get' | 'GET' | 'HEAD' | 'PATCH' | 'POST' | 'PUT' | 'DELETE' | 'CONNECT' | 'OPTIONS' | 'TRACE' | 'head' | 'patch' | 'post' | 'put' | 'delete' | 'connect' | 'options' | 'trace'

type UseFetchOptions = FetchOptions & { method?: method }

export async function useCustomFetch (url: string, options: UseFetchOptions = {}) {
  const defaults: UseFetchOptions = {
    baseURL: 'https://api.nuxtjs.dev'
  }

  const params = Object.assign(defaults, options)

  const { data, p, error, refresh } = await useFetch(url, {
    ...params
  })
}
