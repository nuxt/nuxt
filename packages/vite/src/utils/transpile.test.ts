import { fileURLToPath } from 'node:url'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'

const fixtureDir = fileURLToPath(new URL('../../../../test/fixtures-temp/transpile-test', import.meta.url))

// https://github.com/nuxt/nuxt/issues/33828
describe('async transpile to optimizeDeps.exclude', () => {
  let capturedExclude: string[] = []

  beforeAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true })
    await mkdir(join(fixtureDir, 'app'), { recursive: true })
    await writeFile(join(fixtureDir, 'app/app.vue'), '<template><div/></template>')
    await writeFile(join(fixtureDir, 'nuxt.config.ts'), `
export default defineNuxtConfig({
  modules: [
    (_, nuxt) => {
      nuxt.options.build.transpile.push('my-async-package')
    },
  ],
})
`)
  }, 30000)

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true })
  })

  it('includes async transpile entry in optimizeDeps.exclude', async () => {
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
      dev: true,
    })

    nuxt.hook('vite:configResolved', (config, { isClient }) => {
      if (isClient) {
        capturedExclude = config.optimizeDeps?.exclude || []
      }
    })

    await buildNuxt(nuxt)
    await nuxt.close()

    expect(capturedExclude).toContain('my-async-package')
  }, 60000)
})
