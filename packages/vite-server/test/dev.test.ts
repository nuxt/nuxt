import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bundlerDiagnostics } from '@nuxt/kit/internal'
import type { Nuxt } from '@nuxt/schema'

import { setupDevServer } from '../src/dev.ts'

type Handle = (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => void

const spyOnFailure = () => vi.spyOn(bundlerDiagnostics, 'NUXT_B7036').mockImplementation(() => undefined as never)

async function serve (options: { ssrLoadModule?: () => Promise<unknown>, hasErrorLogged?: (error: unknown) => boolean, handle?: Handle, runnable?: boolean }) {
  const viteServer = {
    middlewares: { handle: options.handle ?? ((_req, _res, next) => next()) satisfies Handle },
    environments: { ssr: options.runnable === false ? {} : { runner: {} } },
    config: { logger: { hasErrorLogged: options.hasErrorLogged ?? (() => false) } },
    ssrLoadModule: options.ssrLoadModule,
  }
  const nuxt = {
    options: {
      rootDir: '/app',
      _layers: [],
      app: { baseURL: '/' },
      devServer: { errorChannel: '/__nuxt_dev__/error' },
      vite: {},
    },
    hook: (name: string, fn: (server: unknown) => void) => name === 'vite:serverCreated' && fn(viteServer),
  } as unknown as Nuxt
  setupDevServer(nuxt, '/app/.nuxt/vite-server/server-entry.mjs')

  const server = createServer(nuxt.server!.handler as Parameters<typeof createServer>[1])
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    fetch: (path: string) => fetch(`http://127.0.0.1:${port}${path}`),
    close: () => new Promise(resolve => server.close(resolve)),
  }
}

describe('the dev server', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('responds with an error to a request it fails, and keeps serving', async () => {
    const failure = spyOnFailure()
    const server = await serve({
      ssrLoadModule: vi.fn()
        .mockRejectedValueOnce(new Error('cannot load the server entry'))
        .mockResolvedValue({ fetch: () => new Response('rendered') }),
    })

    expect((await server.fetch('/about')).status).toBe(500)
    expect(failure).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET', url: '/about', error: expect.stringContaining('cannot load the server entry'), headersSent: false }), { method: 'error' })
    expect(await (await server.fetch('/about')).text()).toBe('rendered')
    await server.close()
  })

  it('leaves an error vite has logged to vite', async () => {
    const failure = spyOnFailure()
    const error = new Error('cannot evaluate the server entry')
    const server = await serve({
      ssrLoadModule: () => Promise.reject(error),
      hasErrorLogged: logged => logged === error,
    })

    expect((await server.fetch('/about')).status).toBe(500)
    expect(failure).not.toHaveBeenCalled()
    await server.close()
  })

  it('cuts off a response it fails after sending the headers, and keeps serving', async () => {
    const failure = spyOnFailure()
    const handle = vi.fn<Handle>((_req, _res, next) => next())
      .mockImplementationOnce((_req, res, next) => {
        res.writeHead(200).write('partial')
        next(new Error('failed mid-response'))
      })
    const server = await serve({ handle, ssrLoadModule: () => Promise.resolve({ fetch: () => new Response('rendered') }) })

    await expect(server.fetch('/about').then(response => response.text())).rejects.toThrow()
    expect(failure).toHaveBeenCalledWith(expect.objectContaining({ headersSent: true }), { method: 'error' })
    expect(await (await server.fetch('/about')).text()).toBe('rendered')
    await server.close()
  })

  it('reports once that requests fall through a target running the ssr environment', async () => {
    const fallthrough = vi.spyOn(bundlerDiagnostics, 'NUXT_B7037').mockImplementation(() => undefined as never)
    const server = await serve({ runnable: false })

    expect((await server.fetch('/about')).status).toBe(500)
    expect((await server.fetch('/')).status).toBe(500)
    expect(fallthrough).toHaveBeenCalledOnce()
    await server.close()
  })
})
