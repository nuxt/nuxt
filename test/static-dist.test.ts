import { fileURLToPath } from 'node:url'
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'

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
