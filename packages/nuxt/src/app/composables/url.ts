import { getRequestURL } from 'h3'
import { joinURL } from 'ufo'
import { useRequestEvent } from './ssr'
import { useRuntimeConfig } from '#app'

export function useRequestURL () {
  if (import.meta.server) {
    const url = getRequestURL(useRequestEvent())
    url.pathname = joinURL(useRuntimeConfig().app.baseURL, url.pathname)
    return url
  }
  return new URL(window.location.href)
}
