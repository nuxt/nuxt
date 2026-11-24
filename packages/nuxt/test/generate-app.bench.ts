import { afterAll, beforeAll, describe, test } from 'vitest'
import { join } from 'pathe'
import type { Nuxt, NuxtApp } from '@nuxt/schema'
import { loadNuxt } from 'nuxt'
import { findWorkspaceDir } from 'pkg-types'
import { createApp, generateApp, invalidateAppStructure } from '../src/core/app.ts'
import { largeAppDir } from '../../../test/bench/large-app.ts'

const repoRoot = await findWorkspaceDir()

const fixtures = {
  'basic test fixture': join(repoRoot, 'test/fixtures/basic'),
  'large generated app': largeAppDir,
}

for (const [fixture, rootDir] of Object.entries(fixtures)) {
  describe(`generateApp in the ${fixture}`, () => {
    let nuxt: Nuxt
    let app: NuxtApp

    beforeAll(async () => {
      nuxt = await loadNuxt({
        cwd: rootDir,
        dev: true,
        ready: true,
        overrides: {
          dev: true,
          buildDir: join(rootDir, 'node_modules/generate-app/.nuxt'),
        },
      })
      app = createApp(nuxt)
      await generateApp(nuxt, app)
    })

    afterAll(() => nuxt?.close())

    test(`regenerate after a file is added in the ${fixture}`, async ({ bench }) => {
      await bench(`regenerate after a file is added in the ${fixture}`, async () => {
        invalidateAppStructure(nuxt)
        await generateApp(nuxt, app)
      }).run()
    })

    test(`regenerate after a file is changed in the ${fixture}`, async ({ bench }) => {
      await bench(`regenerate after a file is changed in the ${fixture}`, async () => {
        await generateApp(nuxt, app)
      }).run()
    })
  })
}
