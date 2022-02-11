import { resolve } from 'path'
import { createServer, AddressInfo } from 'net'
import { execa } from 'execa'
import { getPort } from 'get-port-please'
import { fetch as _fetch, $fetch as _$fetch, FetchOptions } from 'ohmyfetch'
import { useTestContext } from './context'

// TODO: use the export from `get-port-please`
function checkPort (port: number, host: string): Promise<number|false> {
  return new Promise((resolve) => {
    const server = createServer()
    server.unref()
    server.on('error', () => { resolve(false) })
    server.listen(port, host, () => {
      const { port } = server.address() as AddressInfo
      server.close(() => { resolve(port) })
    })
  })
}

export async function listen () {
  const ctx = useTestContext()
  const host = process.env.HOST || '0.0.0.0'
  const port = await getPort({ host })

  ctx.url = 'http://localhost:' + port
  execa('node', [
    // @ts-ignore
    resolve(ctx.nuxt.options.nitro.output.dir, 'server/index.mjs')
  ], {
    env: {
      PORT: String(port),
      NODE_ENV: 'test'
    }
  })

  const TRIES = 50
  const DELAY = 100

  for (let i = TRIES; i; i--) {
    await new Promise(resolve => setTimeout(resolve, DELAY))
    // wait until port is in used
    if (await checkPort(port, host) === false) {
      return
    }
  }
}

export function fetch (path: string, options?: any) {
  return _fetch(url(path), options)
}

export function $fetch (path: string, options?: FetchOptions) {
  return _$fetch(url(path), options)
}

export function url (path: string) {
  const ctx = useTestContext()
  if (!ctx.url) {
    throw new Error('url is not availabe (is server option enabled?)')
  }
  return ctx.url + path
}
