import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import type { Nuxt } from '@nuxt/schema'
import { describe, expect, it, onTestFinished } from 'vitest'
import { loadNuxt } from '../src/loader/nuxt.ts'
import { getNuxtModuleVersion, hasNuxtModule, hasNuxtModuleCompatibility } from '../src/module/compatibility.ts'
import { defineNuxtModule } from '../src/module/define.ts'

describe('nuxt module compatibility', () => {
  it('check module installed', async () => {
    const nuxt = await loadNuxt({
      overrides: {
        modules: [
          defineNuxtModule({
            meta: {
              name: 'nuxt-module-foo',
            },
          }),
          [
            defineNuxtModule({
              meta: {
                name: 'module-instance-with-options',
              },
            }),
            {
              foo: 'bar',
            },
          ],
        ],
      },
    })
    expect(hasNuxtModule('nuxt-module-foo', nuxt)).toStrictEqual(true)
    expect(hasNuxtModule('module-instance-with-options', nuxt)).toStrictEqual(true)
    await nuxt.close()
  })
  it('can retrieve module version from module instance', async () => {
    const nuxt = await loadNuxt({})
    const module = defineNuxtModule({
      meta: {
        name: 'nuxt-module-foo',
        version: '1.0.0',
      },
    })
    expect(await getNuxtModuleVersion(module, nuxt)).toEqual('1.0.0')
    await nuxt.close()
  })
  it('check module instance version compatibility', async () => {
    const nuxt = await loadNuxt({})
    const module = defineNuxtModule({
      meta: {
        name: 'nuxt-module-foo',
        version: '1.0.0',
      },
    })
    expect(await hasNuxtModuleCompatibility(module, '^1.0.0', nuxt)).toStrictEqual(true)
    expect(await hasNuxtModuleCompatibility(module, '^2.0.0', nuxt)).toStrictEqual(false)
    await nuxt.close()
  })
  it('reads the version of a module yet to be installed on the given Nuxt instance', async () => {
    const rootDir = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-module-version-')))
    onTestFinished(() => rm(rootDir, { recursive: true, force: true }))
    const moduleDir = join(rootDir, 'node_modules/some-module')
    await mkdir(moduleDir, { recursive: true })
    await writeFile(join(moduleDir, 'package.json'), JSON.stringify({ name: 'some-module', type: 'module', exports: './index.js' }))
    await writeFile(join(moduleDir, 'index.js'), 'export default () => {}')
    await writeFile(join(moduleDir, 'module.json'), JSON.stringify({ version: '2.0.0' }))

    const nuxt = { options: { rootDir, alias: {}, modulesDir: [join(rootDir, 'node_modules')], modules: ['some-module'], _installedModules: [] } } as unknown as Nuxt
    expect(await getNuxtModuleVersion('some-module', nuxt)).toBe('2.0.0')
  })
})
