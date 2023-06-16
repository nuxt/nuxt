import { getRequestURL } from 'h3'
import { joinURL } from 'ufo'
import { useRequestEvent } from './ssr'
import { useRuntimeConfig } from '#app'

export function useRequestURL () {
  if (process.server) {
    const { baseURL } = useRuntimeConfig().app
    const url = getRequestURL(useRequestEvent())
    url.pathname = joinURL(baseURL, url.pathname)
    return url
  }
  return new URL(window.location.href)
}
