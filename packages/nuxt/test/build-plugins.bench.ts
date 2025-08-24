import { rm } from 'node:fs/promises'
import { afterAll, beforeAll, bench, describe } from 'vitest'
import { join } from 'pathe'
import type { Nuxt } from '@nuxt/schema'
import { build, loadNuxt } from 'nuxt'
import { findWorkspaceDir } from 'pkg-types'

const repoRoot = await findWorkspaceDir()
const basicTestFixtureDir = join(repoRoot, 'test/fixtures/minimal')

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
