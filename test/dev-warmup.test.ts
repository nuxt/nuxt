import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, onTestFinished } from 'vitest'
import { x } from 'tinyexec'
import { getRandomPort } from 'get-port-please'

import { isWebpack, runsOnceInMatrix } from './matrix'

const rootDir = fileURLToPath(new URL('./fixtures/dev-warmup/', import.meta.url))

interface WarmupState { module?: boolean, plugin?: boolean }

/**
 * Start a dev server on `rootDir`, bound to a known address so the test never has to parse
 * the URL out of its output, and resolve once it answers.
 */
async function startDevServer () {
  const port = await getRandomPort('127.0.0.1')
  const url = `http://127.0.0.1:${port}`

  const child = x('pnpm', ['nuxt', 'dev', rootDir, '--host', '127.0.0.1', '--port', String(port), '--no-fork'], {
    // detached so the whole tree can be signalled: killing the package manager on its own
    // leaves the dev server running
    nodeOptions: { detached: true, env: { NUXT_IGNORE_LOCK: '1' } },
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

describe.skipIf(!runsOnceInMatrix || isWebpack)('the dev ssr entry', () => {
  it('is evaluated before the first render, without running plugins', async () => {
    const { url, output } = await startDevServer()

    // a connection error means the server is still starting, so it is polled rather than
    // waited for: the assertions below are about what has run, not about when
    const state = () => fetch(`${url}/api/warmup`)
      .then(r => r.json() as Promise<WarmupState>)
      .catch(() => undefined)

    await expect.poll(async () => (await state())?.module ?? output(), { timeout: 60 * 1000 }).toBe(true)

    expect(await state()).toStrictEqual({ module: true })

    await fetch(url).then(r => r.text())

    expect(await state()).toStrictEqual({ module: true, plugin: true })
  }, 120 * 1000)
})
