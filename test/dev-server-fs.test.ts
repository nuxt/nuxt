import { existsSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, onTestFinished } from 'vitest'
import { x } from 'tinyexec'
import { getRandomPort } from 'get-port-please'
import { join } from 'pathe'
import { joinURL } from 'ufo'

import { isWebpack, runsOnceInMatrix } from './matrix'

const rootDir = fileURLToPath(new URL('./fixtures/dev-server-fs/', import.meta.url))

async function startDevServer (builder: string) {
  const port = await getRandomPort('127.0.0.1')
  const url = `http://127.0.0.1:${port}`

  const child = x('pnpm', ['nuxt', 'dev', rootDir, '--host', '127.0.0.1', '--port', String(port), '--no-fork'], {
    nodeOptions: { detached: true, env: { NUXT_IGNORE_LOCK: '1', TEST_BUILDER: builder } },
  })

  let output = ''
  void (async () => {
    for await (const line of child) { output += line + '\n' }
  })()

  onTestFinished(() => {
    try {
      process.kill(-child.pid!, 'SIGKILL')
    } catch {
      child.kill('SIGKILL')
    }
  })

  return { url, output: () => output }
}

describe.skipIf(!runsOnceInMatrix || isWebpack)('the vite dev server', () => {
  it.each([
    ['vite', '.nuxt'],
    ['vite-env-api', '.nuxt-vite-env-api'],
  ])('does not serve the nitro dev bundle (%s)', async (builder, buildDir) => {
    const { url, output } = await startDevServer(builder)
    const bundle = join(rootDir, buildDir, 'dev/index.mjs')

    await expect.poll(() => fetch(url).then(r => r.ok && existsSync(bundle)).catch(() => output()), { timeout: 60 * 1000 }).toBe(true)

    const fsURL = (path: string) => joinURL(url, '_nuxt/@fs', join(rootDir, path))

    expect((await fetch(fsURL('app/app.vue'))).status).toBe(200)

    const paths = [`${buildDir}/dev/index.mjs`, `${buildDir}/dev/index.mjs?raw`, `${buildDir}/dev/index.mjs.map`]
    if (existsSync(join(rootDir, buildDir, 'DEV/index.mjs'))) {
      paths.push(`${buildDir}/DEV/index.mjs`)
    }

    for (const path of paths) {
      const response = await fetch(fsURL(path))
      expect.soft(response.status, path).toBe(403)
      expect.soft(await response.text(), path).not.toContain('private-value')
    }

    expect((await fetch(fsURL('.env.example'))).status).toBe(403)
  }, 120 * 1000)
})
