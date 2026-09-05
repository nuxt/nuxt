import type { RequestEvent } from '@nuxt/schema'
import { useRequestEvent } from './ssr'

/**
 * Both options are opt-in because the headers can be spoofed by clients: only enable them when
 * the application runs behind a trusted reverse proxy or CDN that sets them. When a header holds
 * a comma-separated list, the first entry is used.
 */
export interface RequestURLOptions {
  /** Resolve the host from the `x-forwarded-host` header, if it is set. */
  xForwardedHost?: boolean
  /** Resolve the protocol from the `x-forwarded-proto` header, if it is set. */
  xForwardedProto?: boolean
}

/** @since 3.5.0 */
export function useRequestURL (opts: RequestURLOptions = {}): URL {
  if (import.meta.server) {
    return getRequestURL(useRequestEvent()!, opts)
  }
  // we use globalThis to avoid crashes in web workers
  return new URL(globalThis.location.href)
}

function getRequestURL (event: RequestEvent, opts: RequestURLOptions): URL {
  const url = new URL(event.url || event.req.url)
  if (opts.xForwardedProto) {
    const proto = event.req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    if (proto === 'http' || proto === 'https') {
      url.protocol = proto
    }
  }
  if (opts.xForwardedHost) {
    const host = event.req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || event.req.headers.get('host')
    if (host) {
      applyForwardedHost(url, host)
    }
  }
  return url
}

function applyForwardedHost (url: URL, host: string) {
  const sep = host.lastIndexOf(':')
  const hasPort = sep > host.lastIndexOf(']')
  const hostname = hasPort ? host.slice(0, sep) : host
  const prevHostname = url.hostname
  url.hostname = hostname
  // an invalid hostname leaves `url.hostname` untouched, in which case the port must not be applied either
  if (url.hostname === prevHostname && hostname.toLowerCase() !== prevHostname) { return }
  const port = hasPort ? host.slice(sep + 1) : ''
  url.port = /^\d{1,5}$/.test(port) && +port < 65536 ? port : ''
}
