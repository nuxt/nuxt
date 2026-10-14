import { fileURLToPath } from 'node:url'
import { lstat, realpath } from 'node:fs/promises'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'

import { copyFixture } from './fixture-copy'
import { runsOnceInMatrix } from './matrix'

describe.skipIf(!runsOnceInMatrix)('static build with nitro as a vite environment', () => {
  it('links `dist` to the public output', async () => {
    const rootDir = fileURLToPath(copyFixture('minimal', 'static-dist'))
    const dist = join(rootDir, 'dist')

    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: {
        experimental: { nitroViteEnvironment: true },
        nitro: { static: true },
      },
    })
    try {
      await buildNuxt(nuxt)
    } finally {
      await nuxt.close()
    }

    expect((await lstat(dist)).isSymbolicLink()).toBe(true)
    expect(await realpath(dist)).toBe(await realpath(join(rootDir, '.output/public')))
  }, 240 * 1000)
})
