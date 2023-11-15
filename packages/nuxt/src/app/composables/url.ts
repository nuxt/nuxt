import { getRequestURL } from 'h3'
import { joinURL } from 'ufo'
import { useRuntimeConfig } from '../nuxt'
import { useRequestEvent } from './ssr'

export function useRequestURL () {
  if (import.meta.server) {
    const url = getRequestURL(useRequestEvent())
    url.pathname = joinURL(useRuntimeConfig().app.baseURL, url.pathname)
    return url
  }
  return new URL(window.location.href)
}
