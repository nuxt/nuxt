import process from 'node:process'
import type { AgentOptions } from 'node:http'
import { configDiagnostics } from '@nuxt/kit/internal'

const PROXY_ENV_VARS = ['https_proxy', 'HTTPS_PROXY', 'http_proxy', 'HTTP_PROXY']
const DEFAULT_DISPATCHER_RE = /^(?:Agent|Dispatcher\d+Wrapper)$/

export function setupProxyFromEnv (): void {
  const env = process.env
  const proxyVar = PROXY_ENV_VARS.find(key => env[key])
  if (env.NODE_USE_ENV_PROXY === '0' || !proxyVar) { return }

  const http = process.getBuiltinModule('node:http')
  const https = process.getBuiltinModule('node:https')
  // Node sets `proxyEnv` on the global agents when its built-in proxy support is already on.
  if (hasProxyEnv(http.globalAgent) || hasProxyEnv(https.globalAgent) || hasCustomDispatcher()) { return }

  if ('setGlobalProxyFromEnv' in http) {
    http.setGlobalProxyFromEnv()
  } else {
    configDiagnostics.NUXT_B5038({ variable: proxyVar, version: process.version })
  }
}

function hasProxyEnv (agent: object): boolean {
  return !!(agent as { options?: AgentOptions }).options?.proxyEnv
}

// Node has no public getter for the global dispatcher, so this reads the keys undici stores it under.
function hasCustomDispatcher (): boolean {
  const globals = globalThis as Record<symbol, { constructor?: { name?: string } } | null | undefined>
  for (const symbol of Object.getOwnPropertySymbols(globalThis)) {
    if (!Symbol.keyFor(symbol)?.startsWith('undici.globalDispatcher.')) { continue }
    const dispatcher = globals[symbol]
    if (dispatcher && !DEFAULT_DISPATCHER_RE.test(dispatcher.constructor?.name ?? '')) { return true }
  }
  return false
}
