import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Agent, EnvHttpProxyAgent, ProxyAgent, getGlobalDispatcher, setGlobalDispatcher } from 'undici'

import { installProxyDispatcher } from '../src/core/utils/proxy.ts'

describe('installProxyDispatcher', () => {
  const originalDispatcher = getGlobalDispatcher()
  const originalEnv = {
    HTTPS_PROXY: process.env.HTTPS_PROXY,
    https_proxy: process.env.https_proxy,
    HTTP_PROXY: process.env.HTTP_PROXY,
    http_proxy: process.env.http_proxy,
  }

  beforeEach(() => {
    delete process.env.HTTPS_PROXY
    delete process.env.https_proxy
    delete process.env.HTTP_PROXY
    delete process.env.http_proxy
    setGlobalDispatcher(new Agent())
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
    setGlobalDispatcher(originalDispatcher)
  })

  it('does nothing when no proxy env var is set', () => {
    const before = getGlobalDispatcher()
    installProxyDispatcher()
    expect(getGlobalDispatcher()).toBe(before)
  })

  it('installs EnvHttpProxyAgent when HTTPS_PROXY is set and dispatcher is the default Agent', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:9999'
    installProxyDispatcher()
    expect(getGlobalDispatcher()).toBeInstanceOf(EnvHttpProxyAgent)
  })

  it('also recognises lowercase variants and HTTP_PROXY', () => {
    process.env.http_proxy = 'http://127.0.0.1:9999'
    installProxyDispatcher()
    expect(getGlobalDispatcher()).toBeInstanceOf(EnvHttpProxyAgent)
  })

  it('is idempotent when already swapped', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:9999'
    const swapped = new EnvHttpProxyAgent()
    setGlobalDispatcher(swapped)
    installProxyDispatcher()
    expect(getGlobalDispatcher()).toBe(swapped)
  })

  it('leaves a user-installed non-default dispatcher alone', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:9999'
    const custom = new ProxyAgent('http://127.0.0.1:8888')
    setGlobalDispatcher(custom)
    installProxyDispatcher()
    expect(getGlobalDispatcher()).toBe(custom)
  })

  it('leaves a user subclass of Agent alone', () => {
    process.env.HTTPS_PROXY = 'http://127.0.0.1:9999'
    class CustomAgent extends Agent {}
    const custom = new CustomAgent()
    setGlobalDispatcher(custom)
    installProxyDispatcher()
    expect(getGlobalDispatcher()).toBe(custom)
  })
})
