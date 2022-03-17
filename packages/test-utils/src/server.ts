import { resolve } from 'path'
import { execa } from 'execa'
import { getRandomPort, waitForPort } from 'get-port-please'
import { fetch as _fetch, $fetch as _$fetch, FetchOptions } from 'ohmyfetch'
import { useTestContext } from './context'

export async function startServer () {
  const ctx = useTestContext()
  await stopServer()
  const port = await getRandomPort()
  ctx.url = 'http://localhost:' + port
  if (ctx.options.dev) {
    ctx.listener = await ctx.nuxt.server.listen(port)
    await waitForPort(port, { retries: 8 })
    for (let i = 0; i < 50; i++) {
      await new Promise(resolve => setTimeout(resolve, 100))
      const res = await $fetch('/')
      if (!res.includes('__NUXT_LOADING__')) {
        return
      }
    }
    throw new Error('Timeout waiting for dev server!')
  } else {
    ctx.serverProcess = execa('node', [
      resolve(ctx.nuxt.options.nitro.output.dir, 'server/index.mjs')
    ], {
      stdio: 'inherit',
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: 'test'
      }
    })
    await waitForPort(port, { retries: 8 })
  }
}

export async function stopServer () {
  const ctx = useTestContext()
  if (ctx.serverProcess) {
    await ctx.serverProcess.kill()
  }
  if (ctx.listener) {
    await ctx.listener.close()
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
