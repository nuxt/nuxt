import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, onTestFinished } from 'vitest'
import { x } from 'tinyexec'
import { getRandomPort } from 'get-port-please'
import { join, relative } from 'pathe'
import { joinURL } from 'ufo'

import { isWebpack, runsOnceInMatrix } from './matrix'

const rootDir = fileURLToPath(new URL('./fixtures/dev-server-fs/', import.meta.url))
const buildDirs = ['.nuxt', '.nuxt-nitro-vite-off']

async function startDevServer (nitroViteEnvironment: boolean) {
  const port = await getRandomPort('127.0.0.1')
  const url = `http://127.0.0.1:${port}`

  const child = x('pnpm', ['nuxt', 'dev', rootDir, '--host', '127.0.0.1', '--port', String(port), '--no-fork'], {
    nodeOptions: { detached: true, env: { NUXT_IGNORE_LOCK: '1', TEST_NITRO_VITE_ENVIRONMENT: String(nitroViteEnvironment) } },
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

async function findFilesContaining (dir: string, needle: string): Promise<string[]> {
  const found: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      found.push(...await findFilesContaining(path, needle))
    } else if (entry.isFile() && (await readFile(path, 'utf8')).includes(needle)) {
      found.push(relative(rootDir, path))
    }
  }
  return found.sort()
}

describe.skipIf(!runsOnceInMatrix || isWebpack)('the vite dev server', () => {
  it.each([
    [false, '.nuxt-nitro-vite-off', ['.nuxt-nitro-vite-off/dev/index.mjs', '.nuxt-nitro-vite-off/dev/index.mjs.map']],
    [true, '.nuxt', []],
  ])('does not serve the private runtime config (nitroViteEnvironment: %s)', async (nitroViteEnvironment, buildDir, written) => {
    const { url, output } = await startDevServer(nitroViteEnvironment)

    await expect.poll(() => fetch(url).then(r => r.ok).catch(() => output()), { timeout: 60 * 1000 }).toBe(true)

    const otherBuildDirs = buildDirs.filter(dir => dir !== buildDir)
    const files = await findFilesContaining(rootDir, 'private-value')
    expect(files.filter(file => file !== 'nuxt.config.ts' && !otherBuildDirs.some(dir => file.startsWith(`${dir}/`)))).toEqual(written)

    const fsURL = (path: string) => joinURL(url, '_nuxt/@fs', join(rootDir, path))

    expect((await fetch(fsURL('app/app.vue'))).status).toBe(200)

    const paths = [`${buildDir}/dev/index.mjs`, `${buildDir}/dev/index.mjs?raw`, `${buildDir}/dev/index.mjs.map`]
    if (existsSync(join(rootDir, buildDir, 'DEV/index.mjs'))) {
      paths.push(`${buildDir}/DEV/index.mjs`)
    }

    for (const path of paths) {
      const response = await fetch(fsURL(path))
      expect.soft(await response.text(), path).not.toContain('private-value')
      if (written.length) {
        expect.soft(response.status, path).toBe(403)
      }
    }

    expect((await fetch(fsURL('.env.example'))).status).toBe(403)
  }, 120 * 1000)
})
