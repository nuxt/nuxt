import http from 'node:http'

// Node's `fetch` and `http` ignore `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` unless started with
// `NODE_USE_ENV_PROXY=1`. `http.setGlobalProxyFromEnv()` needs Node 24.14+; older versions need that env var.
export function installProxyDispatcher (): void {
  if (!('setGlobalProxyFromEnv' in http)) { return }

  // Preserve a dispatcher installed by the user, by `NODE_USE_ENV_PROXY` or by an earlier call.
  const globals = globalThis as Record<symbol, object | undefined>
  const current = globals[Symbol.for('undici.globalDispatcher.2')] ?? globals[Symbol.for('undici.globalDispatcher.1')]
  if (current && current.constructor?.name !== 'Agent') { return }

  http.setGlobalProxyFromEnv()
}
