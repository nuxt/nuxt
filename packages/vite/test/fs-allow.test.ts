import { fileURLToPath } from 'node:url'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'

const nuxtDir = fileURLToPath(new URL('../../nuxt', import.meta.url))

describe('vite dev server fs.allow', () => {
  let parentDir: string
  let rootDir: string

  beforeAll(async () => {
    parentDir = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-fs-allow-')))
    rootDir = join(parentDir, 'project')
    await mkdir(join(rootDir, 'app'), { recursive: true })
    await mkdir(join(rootDir, 'node_modules'), { recursive: true })
    await symlink(nuxtDir, join(rootDir, 'node_modules/nuxt'), 'dir')
    await writeFile(join(rootDir, 'app/app.vue'), '<template><div/></template>')
    await writeFile(join(parentDir, 'secret.txt'), 'secret')
    await mkdir(join(parentDir, 'node_modules/hoisted'), { recursive: true })
    await writeFile(join(parentDir, 'node_modules/hoisted/index.js'), 'export default 1')
    for (const dir of [parentDir, rootDir]) {
      await writeFile(join(dir, 'package.json'), '{}')
      await writeFile(join(dir, 'package-lock.json'), '{}')
    }
  }, 30000)

  afterAll(async () => {
    await rm(parentDir, { recursive: true, force: true })
  })

  it('should serve files from an ancestor node_modules but not next to an ancestor lockfile', async () => {
    const nuxt = await loadNuxt({ cwd: rootDir, dev: true })
    const middlewares = new Promise<Parameters<typeof createServer>[1]>((resolve) => {
      nuxt.hook('vite:serverCreated', (server, { isClient }) => {
        if (isClient) {
          resolve(server.middlewares)
        }
      })
    })

    try {
      await buildNuxt(nuxt)

      const server = createServer(await middlewares)
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
      try {
        const { port } = server.address() as AddressInfo
        const base = `http://127.0.0.1:${port}${nuxt.options.app.buildAssetsDir}@fs`
        const files = [join(parentDir, 'secret.txt'), join(rootDir, 'app/app.vue'), join(parentDir, 'node_modules/hoisted/index.js')]
        expect(await Promise.all(files.map(file => fetch(base + file).then(res => res.status)))).toEqual([403, 200, 200])
      } finally {
        server.close()
      }
    } finally {
      await nuxt.close()
    }
  }, 60000)
})
