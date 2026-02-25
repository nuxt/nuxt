import { rm } from 'node:fs/promises'
import { beforeAll, bench, describe } from 'vitest'
import { join } from 'pathe'
import { build, loadNuxt } from 'nuxt'
import { findWorkspaceDir } from 'pkg-types'

const repoRoot = await findWorkspaceDir()
const basicTestFixtureDir = join(repoRoot, 'test/fixtures/basic')

describe('build', () => {
  beforeAll(async () => {
    await rm(join(basicTestFixtureDir, 'node_modules/build/.nuxt'), { recursive: true, force: true })
  })

  bench('initial dev server build in the basic test fixture', async () => {
    await new Promise((resolve) => {
      loadNuxt({
        cwd: basicTestFixtureDir,
        ready: true,
        overrides: {
          dev: true,
          buildDir: join(basicTestFixtureDir, 'node_modules/build/.nuxt'),
          sourcemap: false,
          builder: {
            async bundle (nuxt) {
              resolve(await nuxt.close())
            },
          },
        },
      }).then(build)
    })
  })
})
