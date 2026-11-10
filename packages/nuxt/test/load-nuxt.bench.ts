import { rm } from 'node:fs/promises'
import { beforeAll, describe, test } from 'vitest'
import { join } from 'pathe'
import { loadNuxt } from 'nuxt'
import { findWorkspaceDir } from 'pkg-types'
import { largeAppDir } from '../../../test/bench/large-app.ts'

const repoRoot = await findWorkspaceDir()

const emptyDir = join(repoRoot, 'node_modules/fixture')
const basicTestFixtureDir = join(repoRoot, 'test/fixtures/basic')

const cases = {
  'loadNuxt in an empty directory': { cwd: emptyDir, dev: false },
  'loadNuxt in the basic test fixture': { cwd: basicTestFixtureDir, dev: false },
  'loadNuxt in the basic test fixture (dev)': { cwd: basicTestFixtureDir, dev: true },
  'loadNuxt in a large generated app (dev)': { cwd: largeAppDir, dev: true },
}

const buildDir = ({ cwd, dev }: { cwd: string, dev: boolean }) => join(cwd, dev ? 'node_modules/load-nuxt-dev/.nuxt' : 'node_modules/load-nuxt/.nuxt')

describe('loadNuxt', () => {
  beforeAll(async () => {
    await Promise.all(Object.values(cases).map(entry => rm(buildDir(entry), { recursive: true, force: true })))
  })

  for (const [name, entry] of Object.entries(cases)) {
    test(name, async ({ bench }) => {
      await bench(name, async () => {
        const nuxt = await loadNuxt({
          cwd: entry.cwd,
          ready: true,
          overrides: {
            dev: entry.dev,
            buildDir: buildDir(entry),
          },
        })
        await nuxt.close()
      }).run()
    })
  }
})
