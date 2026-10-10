import { mkdir, rm, writeFile } from 'node:fs/promises'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
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

describe('nested module dependencies', () => {
  const tempDir = join(repoRoot, 'node_modules/.temp/nested-module-dependencies')
  let nuxt: Nuxt | undefined

  async function writeDependency (directory: string, version: string) {
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'package.json'), JSON.stringify({
      name: 'nested-dependency', version, type: 'module', exports: './index.js',
    }))
    await writeFile(join(directory, 'index.js'), `
export default Object.assign((_options, nuxt) => {
  const previous = nuxt.options.runtimeConfig.nestedDependency
  nuxt.options.runtimeConfig.nestedDependency = {
    version: '${version}',
    message: nuxt.options.nestedDependency.message,
    calls: (previous?.calls || 0) + 1
  }
}, {
  getMeta: () => ({ name: 'nested-dependency', configKey: 'nestedDependency' })
})
    `)
  }

  beforeAll(async () => {
    for (const scenario of ['nested', 'app', 'incompatible']) {
      const parent = join(tempDir, scenario, 'node_modules/parent-module')
      await mkdir(parent, { recursive: true })
      await writeFile(join(parent, 'package.json'), JSON.stringify({
        name: 'parent-module', version: '1.0.0', type: 'module', exports: './index.js',
      }))
      await writeFile(join(parent, 'index.js'), `
export default Object.assign(() => {}, {
  getMeta: () => ({ name: 'parent-module' }),
  getModuleDependencies: () => ({
    'nested-dependency': { version: '>=2', defaults: { message: 'configured' } }
  })
})
      `)
      await writeDependency(join(parent, 'node_modules/nested-dependency'), '2.0.0')
    }
    await writeDependency(join(tempDir, 'app/node_modules/nested-dependency'), '3.0.0')
    await writeDependency(join(tempDir, 'incompatible/node_modules/nested-dependency'), '1.0.0')
  })

  afterEach(async () => {
    await nuxt?.close()
    nuxt = undefined
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('loads a dependency available only from its parent module', async () => {
    nuxt = await loadNuxt({
      cwd: join(tempDir, 'nested'),
      overrides: { modules: ['parent-module'] },
    })

    expect(nuxt.options.runtimeConfig.nestedDependency).toEqual({
      version: '2.0.0', message: 'configured', calls: 1,
    })
  })

  it('keeps an explicitly installed app dependency and applies its defaults once', async () => {
    nuxt = await loadNuxt({
      cwd: join(tempDir, 'app'),
      overrides: { modules: ['nested-dependency', 'parent-module'] },
    })

    expect(nuxt.options.runtimeConfig.nestedDependency).toEqual({
      version: '3.0.0', message: 'configured', calls: 1,
    })
  })

  it('checks the version of the app dependency that will load', async () => {
    await expect(loadNuxt({
      cwd: join(tempDir, 'incompatible'),
      overrides: { modules: ['parent-module'] },
    })).rejects.toThrow(/Module `nested-dependency` version \(`1\.0\.0`\) does not satisfy `>=2`/)
  })
})
