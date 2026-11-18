import { fileURLToPath } from 'node:url'
import { access, lstat, readFile, realpath, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { copyFixture } from './fixture-copy'
import { runsOnceInMatrix } from './matrix'
import { buildInProcess } from './utils'

describe.skipIf(!runsOnceInMatrix)('static build with nitro as a vite environment', () => {
  let rootDir: string

  beforeAll(async () => {
    rootDir = fileURLToPath(copyFixture('minimal', 'static-dist'))
    await buildInProcess(rootDir, {
      experimental: { nitroViteEnvironment: true },
      nitro: { static: true },
      hooks: {
        async 'nitro:build:public-assets' (nitro) {
          await writeFile(join(nitro.options.output.publicDir, 'hook-asset.txt'), 'written in nitro:build:public-assets')
        },
      },
    })
  }, 240 * 1000)

  it('links `dist` to the public output', async () => {
    const dist = join(rootDir, 'dist')
    expect((await lstat(dist)).isSymbolicLink()).toBe(true)
    expect(await realpath(dist)).toBe(await realpath(join(rootDir, '.output/public')))
  })

  it('writes files from the `nitro:build:public-assets` hook', async () => {
    expect(await readFile(join(rootDir, '.output/public/hook-asset.txt'), 'utf-8')).toBe('written in nitro:build:public-assets')
  })
})

describe.skipIf(!runsOnceInMatrix)('static build with a relative base URL', () => {
  let publicDir: string

  beforeAll(async () => {
    const rootDir = fileURLToPath(copyFixture('minimal', 'static-relative-base'))
    publicDir = join(rootDir, '.output/public')
    vi.stubEnv('NUXT_APP_BASE_URL', './')
    try {
      await buildInProcess(rootDir, { nitro: { static: true } })
    } finally {
      vi.unstubAllEnvs()
    }
  }, 240 * 1000)

  it.each(['index.html', '200.html', '404.html'])('writes `%s` with relative asset URLs that exist', async (file) => {
    const html = await readFile(join(publicDir, file), 'utf-8')
    const assets = Array.from(html.matchAll(/(?:href|src)="(\.\/_nuxt\/[^"]+)"/g), m => m[1]!)
    expect(assets.length).toBeGreaterThan(0)
    for (const asset of assets) {
      await expect(access(join(publicDir, asset))).resolves.toBeUndefined()
    }
  })
})
