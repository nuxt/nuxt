import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'

import { setupDevServer } from '../src/dev.ts'

type Handle = (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => void

async function serve (options: { ssrLoadModule: () => Promise<unknown>, hasErrorLogged?: (error: unknown) => boolean, handle?: Handle }) {
  const viteServer = {
    middlewares: { handle: options.handle ?? ((_req, _res, next) => next()) satisfies Handle },
    environments: { ssr: { runner: {} } },
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
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
    const server = await serve({
      ssrLoadModule: vi.fn()
        .mockRejectedValueOnce(new Error('cannot load the server entry'))
        .mockResolvedValue({ fetch: () => new Response('rendered') }),
    })

    expect((await server.fetch('/about')).status).toBe(500)
    expect(error).toHaveBeenCalledWith('Failed to respond to `GET /about`:', expect.objectContaining({ message: 'cannot load the server entry' }))
    expect(await (await server.fetch('/about')).text()).toBe('rendered')
    await server.close()
  })

  it('leaves an error vite has logged to vite', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
    const failure = new Error('cannot evaluate the server entry')
    const server = await serve({
      ssrLoadModule: () => Promise.reject(failure),
      hasErrorLogged: error => error === failure,
    })

    expect((await server.fetch('/about')).status).toBe(500)
    expect(error).not.toHaveBeenCalled()
    await server.close()
  })

  it('cuts off a response it fails after sending the headers, and keeps serving', async () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    const handle = vi.fn<Handle>((_req, _res, next) => next())
      .mockImplementationOnce((_req, res, next) => {
        res.writeHead(200).write('partial')
        next(new Error('failed mid-response'))
      })
    const server = await serve({ handle, ssrLoadModule: () => Promise.resolve({ fetch: () => new Response('rendered') }) })

    await expect(server.fetch('/about').then(response => response.text())).rejects.toThrow()
    expect(await (await server.fetch('/about')).text()).toBe('rendered')
    await server.close()
  })
})
