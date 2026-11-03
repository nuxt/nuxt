import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'
import type { ViteConfig } from '@nuxt/schema'

const fixtureDir = fileURLToPath(new URL('../../../test/fixtures-temp/fs-deny', import.meta.url))

async function fetchStatuses (vite: ViteConfig, paths: string[]) {
  const nuxt = await loadNuxt({ cwd: fixtureDir, dev: true, overrides: { vite } })
  const middlewares = new Promise<Parameters<typeof createServer>[1]>((resolve) => {
    nuxt.hook('vite:serverCreated', (server, { isClient }) => {
      if (isClient) {
        resolve(server.middlewares)
      }
    })
  })

  try {
    await buildNuxt(nuxt)
    expect(existsSync(join(nuxt.options.buildDir, 'app-secret'))).toBe(true)

    const server = createServer(await middlewares)
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      const { port } = server.address() as AddressInfo
      const base = `http://127.0.0.1:${port}${nuxt.options.app.buildAssetsDir}@fs`
      const files = [join(nuxt.options.buildDir, 'app-secret'), ...paths.map(path => join(fixtureDir, path))]
      return await Promise.all(files.map(file => fetch(base + file).then(res => res.status)))
    } finally {
      server.close()
    }
  } finally {
    await nuxt.close()
  }
}

describe('vite dev server fs.deny', () => {
  beforeAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true })
    await mkdir(join(fixtureDir, 'app'), { recursive: true })
    await writeFile(join(fixtureDir, 'app/app.vue'), '<template><div/></template>')
    await writeFile(join(fixtureDir, '.env'), 'SECRET=value')
    await writeFile(join(fixtureDir, 'file.custom'), 'custom')
    await writeFile(join(fixtureDir, 'file.txt'), 'text')
  }, 30000)

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true })
  })

  it('should not serve the generated app secret or files denied by vite defaults', async () => {
    expect(await fetchStatuses({}, ['.env', 'file.custom', 'file.txt'])).toEqual([403, 403, 200, 200])
  }, 60000)

  it('should not serve the generated app secret when `server.fs.deny` is configured', async () => {
    const vite = { server: { fs: { deny: ['*.custom'] } } }
    expect(await fetchStatuses(vite, ['.env', 'file.custom', 'file.txt'])).toEqual([403, 200, 403, 200])
  }, 60000)
})
