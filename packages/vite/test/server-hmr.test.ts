import { type Server, createServer as createHttpServer } from 'node:http'
import { createServer } from 'vite'
import { describe, expect, it } from 'vitest'

import { detachSsrHmrServer } from '../src/server'

const sharedServer = {} as Server

describe('detachSsrHmrServer', () => {
  it('moves the websocket off the shared server onto a dedicated port', () => {
    const server: Record<string, unknown> = { ws: { server: sharedServer }, hmr: { server: sharedServer } }

    detachSsrHmrServer(server, 24690)

    expect(server.ws).toEqual({ server: undefined, port: 24690 })
    expect(server.hmr).toBe(false)
  })

  it('preserves a port set via ws or the deprecated hmr option', () => {
    const fromWs: Record<string, unknown> = { ws: { server: sharedServer, port: 24780 } }
    detachSsrHmrServer(fromWs, 24690)
    expect(fromWs.ws).toMatchObject({ server: undefined, port: 24780 })

    const fromHmr: Record<string, unknown> = { hmr: { port: 24781 } }
    detachSsrHmrServer(fromHmr, 24690)
    expect(fromHmr.ws).toMatchObject({ server: undefined, port: 24781 })
  })

  it('disables the websocket entirely when hmr or ws is off', () => {
    const hmrOff: Record<string, unknown> = { hmr: false, ws: { server: sharedServer } }
    detachSsrHmrServer(hmrOff, 24690)
    expect(hmrOff.hmr).toBe(false)
    expect(hmrOff.ws).toBe(false)

    const wsOff: Record<string, unknown> = { ws: false }
    detachSsrHmrServer(wsOff, 24690)
    expect(wsOff.ws).toBe(false)
  })
})

describe('ssr dev server websocket', () => {
  it('does not register a second upgrade listener on the shared dev server', async () => {
    const shared = createHttpServer()
    const baseConfig = (server: Record<string, unknown>) => ({
      base: '/_nuxt/',
      configFile: false as const,
      logLevel: 'silent' as const,
      server: { middlewareMode: true, ...server },
    })

    const client = await createServer(baseConfig({ ws: { server: shared }, hmr: { server: shared } }))
    expect(shared.listenerCount('upgrade')).toBe(1)

    const ssrServer = { ws: { server: shared }, hmr: { server: shared } }
    detachSsrHmrServer(ssrServer, 24690)
    const ssr = await createServer(baseConfig(ssrServer))
    expect(shared.listenerCount('upgrade')).toBe(1)

    await client.close()
    await ssr.close()
    shared.close()
  })
})
