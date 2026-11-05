import { fileURLToPath } from 'node:url'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'
import type { ResolvedConfig } from 'vite'

const fixtureDir = fileURLToPath(new URL('../../../test/fixtures-temp/vite-environments', import.meta.url))

describe('vite environments', () => {
  beforeAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true })
    await mkdir(join(fixtureDir, 'app'), { recursive: true })
    await writeFile(join(fixtureDir, 'app/app.vue'), '<template><div/></template>')
  }, 30000)

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true })
  })

  it('should merge user `vite.environments` with `$client` and `$server`', async () => {
    let resolved: ResolvedConfig | undefined
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
      dev: true,
      overrides: {
        vite: {
          environments: {
            client: { define: { __USER_CLIENT__: '"environments"' } },
            ssr: { define: { __USER_SSR__: '"environments"', __USER_OVERRIDE__: '"environments"' } },
            custom: { consumer: 'server', define: { __USER_CUSTOM__: '"environments"' } },
          },
          $client: { define: { __USER_DOLLAR_CLIENT__: '"$client"' } },
          $server: { define: { __USER_OVERRIDE__: '"$server"' } },
          plugins: [{
            name: 'test:capture-config',
            configResolved (config) {
              resolved = config
            },
          }],
        },
      },
    })

    try {
      await buildNuxt(nuxt)
    } finally {
      await nuxt.close()
    }

    const { client, ssr, custom } = resolved!.environments
    expect(client!.define).toMatchObject({ __USER_CLIENT__: '"environments"', __USER_DOLLAR_CLIENT__: '"$client"' })
    expect(ssr!.define).toMatchObject({ __USER_SSR__: '"environments"', __USER_OVERRIDE__: '"$server"' })
    expect(custom!.define).toMatchObject({ __USER_CUSTOM__: '"environments"' })
  }, 60000)
})
