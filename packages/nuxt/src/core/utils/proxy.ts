import process from 'node:process'
import { Agent, EnvHttpProxyAgent, getGlobalDispatcher, setGlobalDispatcher } from 'undici'

// Node's built-in `fetch` (undici) ignores `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` unless
// the process was started with `node --use-env-proxy` (Node 24+, experimental).
// At build time this silently breaks any module that does outbound HTTP behind a corporate
// proxy. We install undici's `EnvHttpProxyAgent` as the process-global dispatcher so every
// build-time `fetch` (modules, Nitro prerender, user config) honours the standard env vars.
// Refs:
//   https://nodejs.org/api/cli.html#--use-env-proxy
//   https://undici.nodejs.org/#/docs/api/EnvHttpProxyAgent
export function installProxyDispatcher (): void {
  const proxyUrl
    = process.env.HTTPS_PROXY
      || process.env.https_proxy
      || process.env.HTTP_PROXY
      || process.env.http_proxy
  if (!proxyUrl) { return }

  const current = getGlobalDispatcher()
  if (current instanceof EnvHttpProxyAgent) { return }
  if (current.constructor !== Agent) { return }

  setGlobalDispatcher(new EnvHttpProxyAgent())
}
