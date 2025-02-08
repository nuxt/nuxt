import { fileURLToPath } from 'node:url'
import { rm } from 'node:fs/promises'
import { beforeAll, bench, describe } from 'vitest'
import { join, normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { loadNuxt } from 'nuxt'

const emptyDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('../../../node_modules/fixture', import.meta.url))))
const basicTestFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('../../../test/fixtures/basic', import.meta.url))))

describe('loadNuxt', () => {
  beforeAll(async () => {
    await Promise.all([
      rm(join(emptyDir, '.nuxt'), { recursive: true, force: true }),
      rm(join(basicTestFixtureDir, '.nuxt'), { recursive: true, force: true }),
    ])
  })

  bench('loadNuxt in an empty directory', async () => {
    const nuxt = await loadNuxt({
      cwd: emptyDir,
      ready: true,
    })
    await nuxt.close()
  })

  bench('loadNuxt in the basic test fixture', async () => {
    const nuxt = await loadNuxt({
      cwd: basicTestFixtureDir,
      ready: true,
    })
    await nuxt.close()
  })
})
