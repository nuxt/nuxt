import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import type { AddressInfo } from 'node:net'
import process from 'node:process'
import { ProxyAgent, Agent as UndiciAgent, setGlobalDispatcher } from 'undici'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'
import { configDiagnostics } from '@nuxt/kit/internal'

import { setupProxyFromEnv } from '../src/core/utils/proxy.ts'

const ENV_KEYS = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'NO_PROXY', 'no_proxy', 'NODE_USE_ENV_PROXY']
const globals = globalThis as Record<symbol, unknown>
const dispatcherSymbols = () => Object.getOwnPropertySymbols(globalThis).filter(symbol => Symbol.keyFor(symbol)?.startsWith('undici.globalDispatcher.'))

interface State { agents: [http.Agent, https.Agent], dispatchers: Map<symbol, unknown> }
const snapshot = (): State => ({
  agents: [http.globalAgent, https.globalAgent],
  dispatchers: new Map(dispatcherSymbols().map(symbol => [symbol, globals[symbol]])),
})
function expectSameState (before: State) {
  const after = snapshot()
  expect(after.agents[0]).toBe(before.agents[0])
  expect(after.agents[1]).toBe(before.agents[1])
  expect([...after.dispatchers.keys()]).toEqual([...before.dispatchers.keys()])
  for (const [symbol, dispatcher] of before.dispatchers) {
    expect(after.dispatchers.get(symbol)).toBe(dispatcher)
  }
}

const nativeSetupDescriptor = Object.getOwnPropertyDescriptor(http, 'setGlobalProxyFromEnv')

const proxied: string[] = []
const tunnels = new Set<net.Socket>()
const target = http.createServer((_req, res) => res.end('ok'))
const proxy = http.createServer((req, res) => {
  proxied.push(req.url!)
  const upstream = http.request(req.url!, { method: req.method, headers: req.headers, agent: false }, (response) => {
    res.writeHead(response.statusCode!, response.headers)
    response.pipe(res)
  })
  req.pipe(upstream)
})
proxy.on('connect', (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
  proxied.push(req.url!)
  const [host, port] = req.url!.split(':')
  const upstream = net.connect(Number(port), host, () => {
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    upstream.write(head)
    upstream.pipe(socket)
    socket.pipe(upstream)
  })
  for (const end of [socket, upstream]) {
    tunnels.add(end)
    end.on('error', () => {}).on('close', () => tunnels.delete(end))
  }
})

const listen = (server: http.Server) => new Promise<string>((resolve) => {
  server.listen(0, '127.0.0.1', () => resolve(`127.0.0.1:${(server.address() as AddressInfo).port}`))
})
let targetHost: string
let proxyUrl: string

const viaFetch = (path: string) => fetch(`http://${targetHost}${path}`).then(res => res.text())
const viaHttp = (path: string) => new Promise<string>((resolve, reject) => {
  http.get(`http://${targetHost}${path}`, (res) => {
    let body = ''
    res.on('data', (chunk) => { body += chunk })
    res.on('end', () => resolve(body))
  }).on('error', reject)
})

beforeAll(async () => {
  targetHost = await listen(target)
  proxyUrl = `http://${await listen(proxy)}`
})

afterAll(async () => {
  for (const socket of tunnels) {
    socket.destroy()
  }
  await Promise.all([proxy, target].map(server => new Promise((resolve) => {
    server.closeAllConnections()
    server.close(resolve)
  })))
})

function defineSuite (native: boolean) {
  const originalEnv = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]))
  let original: State
  let nativeSetup: MockInstance | undefined
  let warning: MockInstance

  function expectUntouched (before: State) {
    expectSameState(before)
    expect(warning).not.toHaveBeenCalled()
    if (nativeSetup) {
      expect(nativeSetup).not.toHaveBeenCalled()
    }
  }

  beforeEach(() => {
    original = snapshot()
    for (const key of ENV_KEYS) {
      delete process.env[key]
    }
    http.globalAgent = new http.Agent()
    https.globalAgent = new https.Agent()
    setGlobalDispatcher(new UndiciAgent())
    proxied.length = 0

    warning = vi.spyOn(configDiagnostics, 'NUXT_B5038').mockImplementation(() => ({}) as never)
    if (native) {
      nativeSetup = vi.spyOn(http, 'setGlobalProxyFromEnv')
    } else if (nativeSetupDescriptor) {
      Reflect.deleteProperty(http, 'setGlobalProxyFromEnv')
    }
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    nativeSetup = undefined
    if (nativeSetupDescriptor) {
      Object.defineProperty(http, 'setGlobalProxyFromEnv', nativeSetupDescriptor)
    }

    const installed = new Set(dispatcherSymbols().map(symbol => globals[symbol] as { destroy?: () => Promise<void> } | undefined))
    for (const symbol of dispatcherSymbols()) {
      globals[symbol] = original.dispatchers.get(symbol)
    }
    await Promise.all([...installed].map(dispatcher => dispatcher?.destroy?.().catch(() => {})))
    http.globalAgent.destroy()
    https.globalAgent.destroy()
    ;[http.globalAgent, https.globalAgent] = original.agents

    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  it.runIf(native)('routes fetch and node:http through HTTP_PROXY', async () => {
    process.env.HTTP_PROXY = proxyUrl
    setupProxyFromEnv()
    expect(await viaFetch('/fetch')).toBe('ok')
    expect(await viaHttp('/http')).toBe('ok')
    expect(proxied).toHaveLength(2)
    expect(proxied.every(url => url.includes(targetHost))).toBe(true)
    expect(warning).not.toHaveBeenCalled()
  })

  it.runIf(native)('recognises lowercase http_proxy', async () => {
    process.env.http_proxy = proxyUrl
    setupProxyFromEnv()
    expect(await viaFetch('/fetch')).toBe('ok')
    expect(proxied).toHaveLength(1)
    expect(proxied[0]).toContain(targetHost)
  })

  it.runIf(native)('routes fetch and node:https through HTTPS_PROXY', async () => {
    process.env.HTTPS_PROXY = proxyUrl
    setupProxyFromEnv()
    await expect(fetch(`https://${targetHost}/fetch`)).rejects.toThrow()
    await new Promise(resolve => https.get(`https://${targetHost}/https`).on('error', resolve))
    expect(proxied).toEqual([targetHost, targetHost])
  })

  it.runIf(native)('replaces a default Agent from another copy of undici', async () => {
    process.env.HTTP_PROXY = proxyUrl
    setGlobalDispatcher(new (class Agent extends UndiciAgent {})())
    setupProxyFromEnv()
    expect(await viaFetch('/fetch')).toBe('ok')
    expect(proxied).toHaveLength(1)
    expect(proxied[0]).toContain(targetHost)
  })

  it.runIf(native)('sends only hosts in NO_PROXY directly', async () => {
    process.env.HTTP_PROXY = proxyUrl
    process.env.NO_PROXY = targetHost
    setupProxyFromEnv()
    expect(await viaFetch('/fetch')).toBe('ok')
    expect(await viaHttp('/http')).toBe('ok')
    expect(proxied).toEqual([])
    const otherHost = targetHost.replace('127.0.0.1', 'localhost')
    expect(await fetch(`http://${otherHost}/fetch`).then(res => res.text())).toBe('ok')
    expect(proxied).toHaveLength(1)
    expect(proxied[0]).toContain(otherHost)
  })

  it.runIf(native)('configures the proxy only once', () => {
    process.env.HTTP_PROXY = proxyUrl
    setupProxyFromEnv()
    http.globalAgent = new http.Agent()
    const before = snapshot()
    setupProxyFromEnv()
    expectSameState(before)
    expect(nativeSetup).toHaveBeenCalledTimes(1)
  })

  it.runIf(!native)('warns and leaves requests direct', async () => {
    process.env.http_proxy = proxyUrl
    const before = snapshot()
    setupProxyFromEnv()
    expectSameState(before)
    expect(warning).toHaveBeenCalledExactlyOnceWith({ variable: 'http_proxy', version: process.version })
    expect(await viaFetch('/fetch')).toBe('ok')
    expect(proxied).toEqual([])
  })

  it('does nothing without a proxy variable', () => {
    const before = snapshot()
    setupProxyFromEnv()
    expectUntouched(before)
  })

  it('does nothing when NODE_USE_ENV_PROXY=0', () => {
    process.env.HTTPS_PROXY = proxyUrl
    process.env.NODE_USE_ENV_PROXY = '0'
    const before = snapshot()
    setupProxyFromEnv()
    expectUntouched(before)
  })

  it('does nothing when Node proxy support is already on', () => {
    process.env.HTTPS_PROXY = proxyUrl
    https.globalAgent = new https.Agent({ proxyEnv: { HTTPS_PROXY: proxyUrl } })
    const before = snapshot()
    setupProxyFromEnv()
    expectUntouched(before)
  })

  it('keeps a dispatcher the user installed', () => {
    process.env.HTTPS_PROXY = proxyUrl
    setGlobalDispatcher(new ProxyAgent('http://127.0.0.1:1'))
    const before = snapshot()
    setupProxyFromEnv()
    expectUntouched(before)
  })

  it('keeps a dispatcher stored only under the legacy undici key', () => {
    process.env.HTTPS_PROXY = proxyUrl
    globals[Symbol.for('undici.globalDispatcher.1')] = { dispatch: () => true }
    const before = snapshot()
    setupProxyFromEnv()
    expectUntouched(before)
  })

  it('keeps a dispatcher without a constructor', () => {
    process.env.HTTPS_PROXY = proxyUrl
    globals[Symbol.for('undici.globalDispatcher.2')] = Object.assign(Object.create(null), { dispatch: () => true })
    const before = snapshot()
    setupProxyFromEnv()
    expectUntouched(before)
  })
}

describe.skipIf(!nativeSetupDescriptor)('setupProxyFromEnv with http.setGlobalProxyFromEnv', () => defineSuite(true))
describe('setupProxyFromEnv without http.setGlobalProxyFromEnv', () => defineSuite(false))
