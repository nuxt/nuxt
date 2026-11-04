import { fileURLToPath } from 'node:url'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'

const nuxtDir = fileURLToPath(new URL('../../nuxt', import.meta.url))

describe('vite dev server allowedHosts', () => {
  let rootDir: string

  beforeAll(async () => {
    rootDir = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-allowed-hosts-')))
    await mkdir(join(rootDir, 'app'), { recursive: true })
    await mkdir(join(rootDir, 'node_modules'), { recursive: true })
    await symlink(nuxtDir, join(rootDir, 'node_modules/nuxt'), 'dir')
    await writeFile(join(rootDir, 'app/app.vue'), '<template><div/></template>')
    await writeFile(join(rootDir, 'package.json'), '{}')
  }, 30000)

  afterAll(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  it('should list each allowed host once', async () => {
    const nuxt = await loadNuxt({
      cwd: rootDir,
      dev: true,
      overrides: {
        devServer: { host: 'my-machine.lan' },
        vite: { server: { allowedHosts: ['proxy.test'] } },
      },
    })
    let allowedHosts: unknown
    nuxt.hook('vite:extend', (ctx) => {
      allowedHosts = ctx.config.server?.allowedHosts
    })

    try {
      await buildNuxt(nuxt)
      expect(allowedHosts).toEqual(['proxy.test', 'my-machine.lan'])
    } finally {
      await nuxt.close()
    }
  }, 60000)
})
