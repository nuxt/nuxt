import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'
import { beforeAll, bench, describe } from 'vitest'
import { join, normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { build, loadNuxt } from 'nuxt'

const emptyDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('../../../node_modules/fixture', import.meta.url))))
const basicTestFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('../../../test/fixtures/basic', import.meta.url))))

describe('build', () => {
  beforeAll(async () => {
    await Promise.all([
      rm(join(emptyDir, '.nuxt'), { recursive: true, force: true }),
      rm(join(basicTestFixtureDir, '.nuxt'), { recursive: true, force: true }),
    ])
  })

  bench('initial dev server build in an empty directory', async () => {
    const nuxt = await loadNuxt({
      cwd: emptyDir,
      ready: true,
      overrides: {
        dev: true,
        sourcemap: false,
        builder: {
          bundle: () => Promise.resolve(),
        },
      },
    })
    await new Promise<void>((resolve) => {
      nuxt.hook('build:done', () => resolve())
      build(nuxt)
    })
    await nuxt.close()
  })

  bench('initial dev server build in the basic test fixture', async () => {
    const nuxt = await loadNuxt({
      cwd: basicTestFixtureDir,
      ready: true,
      overrides: {
        dev: true,
        sourcemap: false,
        builder: {
          bundle: () => Promise.resolve(),
        },
      },
    })
    await new Promise<void>((resolve) => {
      nuxt.hook('build:done', () => resolve())
      build(nuxt)
    })
    await nuxt.close()
  })
})
