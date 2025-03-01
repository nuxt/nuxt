import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'
import { afterAll, beforeAll, bench, describe } from 'vitest'
import { join, normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { build, loadNuxt } from 'nuxt'
import type { Nuxt } from '@nuxt/schema'

const basicTestFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('../../../test/fixtures/minimal', import.meta.url))))

describe('build', () => {
  let nuxt: Nuxt
  beforeAll(async () => {
    await rm(join(basicTestFixtureDir, 'node_modules/build-plugins/.nuxt'), { recursive: true, force: true })
    nuxt = await loadNuxt({
      cwd: basicTestFixtureDir,
      ready: true,
      overrides: {
        buildDir: join(basicTestFixtureDir, 'node_modules/build-plugins/.nuxt'),
        ssr: false,
        sourcemap: false,
        hooks: {
          'build:done': () => {
            throw new Error('bypass nitro build')
          },
        },
      },
    })
  })

  afterAll(() => nuxt?.close())

  bench('initial production build in the minimal test fixture', async () => {
    await build(nuxt).catch((e) => {
      if (!e?.toString().includes('bypass nitro build')) {
        throw e
      }
    })
  })
})
