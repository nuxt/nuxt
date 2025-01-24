import { fileURLToPath } from 'node:url'
import { bench, describe } from 'vitest'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { build, loadNuxt } from 'nuxt'

const emptyDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('../../../node_modules/fixture', import.meta.url))))
const basicTestFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('../../../test/fixtures/basic', import.meta.url))))

describe('build', () => {
  bench('initial dev server build in an empty directory', async () => {
    const nuxt = await loadNuxt({
      cwd: emptyDir,
      ready: true,
      overrides: {
        dev: true,
        sourcemap: false,
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
      },
    })
    await new Promise<void>((resolve) => {
      nuxt.hook('build:done', () => resolve())
      build(nuxt)
    })
    await nuxt.close()
  })
})
