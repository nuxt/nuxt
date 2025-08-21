import { rm } from 'node:fs/promises'
import { beforeAll, bench, describe } from 'vitest'
import { join } from 'pathe'
import { loadNuxt } from 'nuxt'
import { findWorkspaceDir } from 'pkg-types'

const repoRoot = await findWorkspaceDir()

const emptyDir = join(repoRoot, 'node_modules/fixture')
const basicTestFixtureDir = join(repoRoot, 'test/fixtures/basic')

describe('loadNuxt', () => {
  beforeAll(async () => {
    await Promise.all([
      rm(join(emptyDir, 'node_modules/load-nuxt/.nuxt'), { recursive: true, force: true }),
      rm(join(basicTestFixtureDir, 'node_modules/load-nuxt/.nuxt'), { recursive: true, force: true }),
    ])
  })

  bench('loadNuxt in an empty directory', async () => {
    const nuxt = await loadNuxt({
      cwd: emptyDir,
      ready: true,
      overrides: {
        buildDir: join(emptyDir, 'node_modules/load-nuxt/.nuxt'),
      },
    })
    await nuxt.close()
  })

  bench('loadNuxt in the basic test fixture', async () => {
    const nuxt = await loadNuxt({
      cwd: basicTestFixtureDir,
      ready: true,
      overrides: {
        buildDir: join(basicTestFixtureDir, 'node_modules/load-nuxt/.nuxt'),
      },
    })
    await nuxt.close()
  })
})
