import { fileURLToPath } from 'node:url'
import { bench, describe } from 'vitest'
import { normalize } from 'pathe'
import { withoutTrailingSlash } from 'ufo'
import { loadNuxt } from '../src'

const emptyDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('../../../node_modules/fixture', import.meta.url))))
const basicTestFixtureDir = withoutTrailingSlash(normalize(fileURLToPath(new URL('../../../test/fixtures/basic', import.meta.url))))

describe('loadNuxt', () => {
  bench('empty directory', async () => {
    const nuxt = await loadNuxt({
      cwd: emptyDir,
      ready: true
    })
    await nuxt.close()
  })

  bench('basic test fixture', async () => {
    const nuxt = await loadNuxt({
      cwd: basicTestFixtureDir,
      ready: true
    })
    await nuxt.close()
  })
})
