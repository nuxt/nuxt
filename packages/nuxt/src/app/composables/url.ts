import { getRequestURL as getServerRequestURL } from 'h3'
import { useRequestEvent } from './ssr'
import { useRuntimeConfig } from '#app'

export function getRequestURL () {
  if (process.server) {
    return getServerRequestURL(useRequestEvent())
  }
  const { baseURL } = useRuntimeConfig().app
  return new URL(window.location.href.replace(baseURL, '/'))
}
