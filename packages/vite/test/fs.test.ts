import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'
import type { NuxtConfig, ViteConfig } from '@nuxt/schema'

const nuxtDir = fileURLToPath(new URL('../../nuxt', import.meta.url))

const serverOutputFiles = [
  '.output/server/index.mjs',
  'node_modules/.cache/nuxt/.nuxt/prerender/index.mjs',
  '.nuxt/prerender/index.mjs',
]

describe('vite dev server fs restrictions', () => {
  let parentDir: string
  let rootDir: string

  beforeAll(async () => {
    parentDir = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-fs-')))
    rootDir = join(parentDir, 'project')
    await mkdir(join(rootDir, 'app'), { recursive: true })
    await mkdir(join(rootDir, 'node_modules'), { recursive: true })
    await symlink(nuxtDir, join(rootDir, 'node_modules/nuxt'), 'dir')
    await writeFile(join(rootDir, 'app/app.vue'), '<template><div/></template>')
    await writeFile(join(rootDir, '.env'), 'SECRET=value')
    await writeFile(join(rootDir, 'file.custom'), 'custom')
    await writeFile(join(rootDir, 'file.txt'), 'text')
    for (const file of serverOutputFiles) {
      await mkdir(dirname(join(rootDir, file)), { recursive: true })
      await writeFile(join(rootDir, file), 'export const secret = 1')
    }
    await writeFile(join(parentDir, 'secret.txt'), 'secret')
    await mkdir(join(parentDir, 'node_modules/hoisted'), { recursive: true })
    await writeFile(join(parentDir, 'node_modules/hoisted/index.js'), 'export default 1')
    for (const dir of [parentDir, rootDir]) {
      await writeFile(join(dir, 'package.json'), '{}')
      await writeFile(join(dir, 'package-lock.json'), '{}')
    }
  }, 30000)

  afterAll(async () => {
    await rm(parentDir, { recursive: true, force: true, maxRetries: 3 })
  })

  async function fetchStatuses (vite: ViteConfig, files: (buildDir: string) => string[], overrides: NuxtConfig = {}) {
    const nuxt = await loadNuxt({ cwd: rootDir, dev: true, overrides: { ...overrides, vite } })
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
        return await Promise.all(files(nuxt.options.buildDir).map(file => fetch(base + file).then(res => res.status)))
      } finally {
        server.close()
      }
    } finally {
      await nuxt.close()
    }
  }

  it('should serve the project and ancestor node_modules, but not the app secret, files denied by vite or files next to an ancestor lockfile', async () => {
    const statuses = await fetchStatuses({}, buildDir => [
      join(buildDir, 'app-secret'),
      join(rootDir, '.env'),
      join(parentDir, 'secret.txt'),
      join(rootDir, 'file.custom'),
      join(rootDir, 'app/app.vue'),
      join(parentDir, 'node_modules/hoisted/index.js'),
    ])
    expect(statuses).toEqual([403, 403, 403, 200, 200, 200])
  }, 60000)

  it('should not serve nitro server output', async () => {
    const customOutputFile = join(rootDir, 'custom-output/server/index.mjs')
    const statuses = await fetchStatuses({}, () => {
      mkdirSync(dirname(customOutputFile), { recursive: true })
      writeFileSync(customOutputFile, 'export const secret = 1')
      return [
        ...serverOutputFiles.map(file => join(rootDir, file)),
        customOutputFile,
        join(rootDir, 'file.txt'),
      ]
    }, { nitro: { output: { dir: 'custom-output' } } })
    expect(statuses).toEqual([403, 403, 403, 403, 200])
  }, 60000)

  it('should not serve the app secret when `server.fs.deny` is configured', async () => {
    const statuses = await fetchStatuses({ server: { fs: { deny: ['*.custom'] } } }, buildDir => [
      join(buildDir, 'app-secret'),
      join(rootDir, '.env'),
      join(rootDir, 'file.custom'),
      join(rootDir, 'file.txt'),
    ])
    expect(statuses).toEqual([403, 200, 403, 200])
  }, 60000)
})
