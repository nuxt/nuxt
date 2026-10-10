import { mkdir, rm, writeFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { join } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import { loadNuxt } from '../src/loader/nuxt.ts'
import { defineNuxtModule } from '../src/module/define.ts'

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

describe('nuxt module dependency resolution', () => {
  const tempDir = join(repoRoot, 'node_modules/.temp/module-dependency-resolution-test')
  const parentModule = join(tempDir, 'node_modules/parent-module')
  const hoistedModule = join(tempDir, 'node_modules/hoisted-module')

  const writeModule = async (dir: string, name: string, source: string) => {
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', type: 'module', exports: './index.js' }))
    await writeFile(join(dir, 'index.js'), source)
  }

  beforeAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
    await writeModule(parentModule, 'parent-module', `
export default Object.assign(() => {}, {
  getMeta: () => ({ name: 'parent-module' }),
  getModuleDependencies: () => ({
    'nested-module': { defaults: { foo: 'bar' } },
    'hoisted-module': {},
  }),
})
    `)
    await writeModule(join(parentModule, 'node_modules/nested-module'), 'nested-module', `
export default Object.assign(() => {}, {
  getMeta: () => ({ name: 'nested-module', configKey: 'nestedModule' })
})
    `)
    await writeModule(hoistedModule, 'hoisted-module', `
export default Object.assign(() => {}, {
  getMeta: () => ({ name: 'hoisted-module' })
})
    `)
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('installs a dependency only resolvable from the declaring module', async () => {
    const nuxt = await loadNuxt({
      cwd: tempDir,
      overrides: { modules: ['parent-module'] },
    })

    const installed = nuxt.options._installedModules.filter(m => m.meta.name === 'nested-module')
    expect(installed).toHaveLength(1)
    expect(installed[0]!.entryPath).toBe('nested-module')
    expect((nuxt.options as any).nestedModule).toEqual({ foo: 'bar' })

    await nuxt.close()
  })

  it('deduplicates a dependency the app also installs by path', async () => {
    const nuxt = await loadNuxt({
      cwd: tempDir,
      overrides: { modules: [hoistedModule, 'parent-module'] },
    })

    expect(nuxt.options._installedModules.filter(m => m.meta.name === 'hoisted-module')).toHaveLength(1)

    await nuxt.close()
  })
})
