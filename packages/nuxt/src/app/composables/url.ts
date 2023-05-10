import { getRequestURL as getServerRequestURL } from 'h3'
import { useRequestEvent } from './ssr'

export function getRequestURL() {
  if (process.server) {
    return getServerRequestURL(useRequestEvent())
  }
  return new URL(window.location.href)
}
