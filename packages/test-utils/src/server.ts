import { resolve } from 'node:path'
import { execa } from 'execa'
import { getRandomPort, waitForPort } from 'get-port-please'
import type { FetchOptions } from 'ofetch'
import { fetch as _fetch, $fetch as _$fetch } from 'ofetch'
import * as _kit from '@nuxt/kit'
import { useTestContext } from './context'

// @ts-ignore type cast
const kit: typeof _kit = _kit.default || _kit

export async function startDevServer () {
  const ctx = useTestContext()
  await stopServer()
  const port = await getRandomPort()
  const nuxiCLI = await kit.resolvePath('nuxi/cli')
  ctx.serverProcess = execa(nuxiCLI, ['dev'], {
    cwd: ctx.options.rootDir,
    env: {
      ...process.env,
      PORT: String(port),
      NITRO_PORT: String(port),
      NODE_ENV: 'development',
      NUXT_CONFIG_OVERRIDES: JSON.stringify(ctx.options.nuxtConfig)
    }
  })
  console.log('boot dev server', ctx.options.rootDir, JSON.stringify(ctx.options.nuxtConfig))
  // wait until the server process displays the listening path
  ctx.url = await new Promise<string>(resolve => {
    // @ts-expect-error untyoed
    ctx.serverProcess.stdout?.on('data', (data: Buffer) => {
      console.log(data.toString())
      if (data.toString().includes('Local:')) {
        console.log('resolving')
        resolve(data.toString().split('Local:')[1].trim())
      }
    })
  })
  await waitForPort(port, { retries: 32 })
  for (let i = 0; i < 50; i++) {
    await new Promise(resolve => setTimeout(resolve, 100))
    try {
      const res = await $fetch(ctx.url)
      if (!res.includes('__NUXT_LOADING__')) {
        return
      }
    } catch {}
  }
  ctx.serverProcess.kill()
  throw new Error('Timeout waiting for dev server!')
}


export async function startServer () {
  const ctx = useTestContext()
  await stopServer()
  const port = await getRandomPort()
  ctx.url = 'http://127.0.0.1:' + port
  ctx.serverProcess = execa('node', [
    resolve(ctx.nuxt!.options.nitro.output!.dir!, 'server/index.mjs')
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: String(port),
      NITRO_PORT: String(port),
      NODE_ENV: 'test'
    }
  })
  await waitForPort(port, { retries: 8 })
}

export async function stopServer () {
  const ctx = useTestContext()
  if (ctx.serverProcess) {
    await ctx.serverProcess.kill()
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
    throw new Error('url is not available (is server option enabled?)')
  }
  return ctx.url + path
}
