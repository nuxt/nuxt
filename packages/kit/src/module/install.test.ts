import { mkdir, rm, writeFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { join } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import { loadNuxt } from '../loader/nuxt.ts'
import { defineNuxtModule } from './define.ts'

const repoRoot = await findWorkspaceDir()

describe('nuxt module install', () => {
  const tempDir = join(repoRoot, 'node_modules/.temp/module-prerelease-test')

  beforeAll(async () => {
    const prereleaseModule = join(tempDir, 'node_modules/prerelease-module')
    await mkdir(prereleaseModule, { recursive: true })
    await writeFile(join(prereleaseModule, 'package.json'), JSON.stringify({
      name: 'prerelease-module',
      version: '2.0.0-beta.1',
      type: 'module',
      exports: './index.js',
    }))
    await writeFile(join(prereleaseModule, 'index.js'), `
export default Object.assign(() => {}, {
  getMeta: () => ({
    name: 'prerelease-module',
    configKey: 'prereleaseModule'
  })
})
    `)
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('accounts for prerelease versions in module dependencies', async () => {
    const nuxt = await loadNuxt({
      cwd: tempDir,
      overrides: {
        modules: [
          defineNuxtModule({
            meta: {
              name: 'parent-module',
              version: '1.0.0',
            },
            moduleDependencies: {
              'prerelease-module': {
                version: '>=1',
              },
            },
            setup () {},
          }),
        ],
      },
    })

    await nuxt.close()
  })

  it('rejects incompatible prerelease versions in module dependencies', async () => {
    await expect(loadNuxt({
      cwd: tempDir,
      overrides: {
        modules: [
          defineNuxtModule({
            meta: {
              name: 'parent-module',
              version: '1.0.0',
            },
            moduleDependencies: {
              'prerelease-module': {
                version: '>=3',
              },
            },
            setup () {},
          }),
        ],
      },
    })).rejects.toThrow(/Module `prerelease-module` version \(`2\.0\.0-beta\.1`\) does not satisfy `>=3`/)
  })
})
