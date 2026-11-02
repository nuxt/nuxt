import http from 'node:http'
import https from 'node:https'
import process from 'node:process'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { installProxyDispatcher } from '../src/core/utils/proxy.ts'

const globals = globalThis as Record<symbol, object | undefined>
const dispatcherSymbols = [Symbol.for('undici.globalDispatcher.1'), Symbol.for('undici.globalDispatcher.2')]
const getGlobalDispatcher = () => globals[dispatcherSymbols[1]!] ?? globals[dispatcherSymbols[0]!]

describe.skipIf(!('setGlobalProxyFromEnv' in http))('installProxyDispatcher', () => {
  let originalDispatchers: Array<object | undefined>
  const originalAgents = [http.globalAgent, https.globalAgent] as const
  const originalEnv = {
    HTTPS_PROXY: process.env.HTTPS_PROXY,
    https_proxy: process.env.https_proxy,
    HTTP_PROXY: process.env.HTTP_PROXY,
    http_proxy: process.env.http_proxy,
  }

  beforeAll(async () => {
    // Node creates its default dispatcher on the first `fetch`.
    await fetch('data:,')
    originalDispatchers = dispatcherSymbols.map(symbol => globals[symbol])
  })

  beforeEach(() => {
    delete process.env.HTTPS_PROXY
    delete process.env.https_proxy
    delete process.env.HTTP_PROXY
    delete process.env.http_proxy
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
    dispatcherSymbols.forEach((symbol, index) => {
      globals[symbol] = originalDispatchers[index]
    })
    ;[http.globalAgent, https.globalAgent] = originalAgents
  })

  it('does nothing when no proxy env var is set', () => {
    const before = getGlobalDispatcher()
    installProxyDispatcher()
    expect(getGlobalDispatcher()).toBe(before)
  })

  it('proxies fetch and node:http/https when HTTPS_PROXY or http_proxy is set, once', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:9999'
    process.env.http_proxy = 'http://127.0.0.1:9999'
    installProxyDispatcher()
    const installed = [getGlobalDispatcher(), http.globalAgent, https.globalAgent]
    expect(installed[0]?.constructor.name).toBe('EnvHttpProxyAgent')
    expect(installed[1]).not.toBe(originalAgents[0])
    expect(installed[2]).not.toBe(originalAgents[1])

    installProxyDispatcher()
    for (const [index, current] of [getGlobalDispatcher(), http.globalAgent, https.globalAgent].entries()) {
      expect(current).toBe(installed[index])
    }
  })

  it('leaves a user-installed non-default dispatcher alone', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:9999'
    const custom = { dispatch: () => true }
    for (const symbol of dispatcherSymbols) {
      globals[symbol] = custom
    }
    installProxyDispatcher()
    expect(getGlobalDispatcher()).toBe(custom)
  })
})
