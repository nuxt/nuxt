import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'
import { beforeAll, bench, describe } from 'vitest'
import { join, normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { build, loadNuxt } from 'nuxt'

const basicTestFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('../../../test/fixtures/basic', import.meta.url))))

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
