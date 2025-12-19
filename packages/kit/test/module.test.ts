import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { appendFileSync } from 'node:fs'

import type { Nuxt } from 'nuxt/schema'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { join } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import { read as readRc, write as writeRc } from 'rc9'

import { defineNuxtModule, installModule, loadNuxt } from '../src/index.ts'

const repoRoot = await findWorkspaceDir()

describe('installNuxtModule', { sequential: true }, () => {
  let nuxt: Nuxt

  const tempDir = join(repoRoot, 'node_modules/.temp/module-temp-hooks')
  const hooksLogFile = join(tempDir, 'hooks-logs')

  async function getHooksLogs () {
    const logs = await readFile(hooksLogFile, { encoding: 'utf8' }).catch(_ => '')
    return logs.split('\n').slice(0, -1)
  }

  const testModule = defineNuxtModule({
    meta: {
      name: 'test-module',
      version: '1.0.0',
    },

    onInstall () {
      appendFileSync(hooksLogFile, 'install\n')
    },

    onUpgrade () {
      appendFileSync(hooksLogFile, 'upgrade\n')
    },
  })

  beforeAll(async () => {
    await mkdir(join(tempDir, 'nuxt'), { recursive: true })
    await rm(hooksLogFile, { force: true })
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  afterEach(async () => {
    await nuxt?.close()
    await rm(hooksLogFile, { force: true })
  })

  it('runs onInstall hook when a module is added', async () => {
    nuxt = await loadNuxt({ cwd: tempDir })
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    await installModule(testModule, {}, nuxt)

    expect(await getHooksLogs()).toEqual(['install'])
    const rc = readRc({ dir: tempDir, name: '.nuxtrc' })
    expect(rc.setups['test-module']).toBe('1.0.0')
  })

  it('runs onInstall only once', async () => {
    writeRc(
      { setups: { 'test-module': '1.0.0' } },
      { dir: tempDir, name: '.nuxtrc' },
    )

    nuxt = await loadNuxt({ cwd: tempDir })
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    await installModule(testModule, {}, nuxt)

    expect(await getHooksLogs()).toEqual([])
  })

  it('runs onUpgrade hook when a module is upgraded', async () => {
    writeRc(
      { setups: { 'test-module': '0.1.0' } },
      { dir: tempDir, name: '.nuxtrc' },
    )

    nuxt = await loadNuxt({ cwd: tempDir })
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    await installModule(testModule, {}, nuxt)

    expect(await getHooksLogs()).toEqual(['upgrade'])
    const rc = readRc({ dir: tempDir, name: '.nuxtrc' })
    expect(rc.setups['test-module']).toBe('1.0.0')
  })
})

describe('module dependencies', { sequential: true }, () => {
  let nuxt: Nuxt

  const tempDir = join(repoRoot, 'node_modules/.temp/module-dependencies')

  beforeAll(async () => {
    const fakeModule = join(tempDir, 'node_modules/some-module')
    await mkdir(fakeModule, { recursive: true })
    await writeFile(join(fakeModule, 'package.json'), JSON.stringify({ name: 'some-module', version: '1.0.0', type: 'module', exports: './index.js' }))
    await writeFile(join(fakeModule, 'index.js'), `
export default Object.assign((options) => {
  globalThis.someModuleLoaded ||= 0
  globalThis.someModuleLoaded++
  globalThis.someModuleOptions = options
}, {
  getMeta: () => ({
    configKey: 'someModule'
  })
})
    `)
  })

  beforeEach(() => {
    delete globalThis.someModuleLoaded
    delete globalThis.someModuleOptions
  })

  afterEach(async () => {
    await nuxt?.close()
  })

  it('should install modules that are not marked as optional', async () => {
    nuxt = await loadNuxt({
      cwd: tempDir,
      overrides: {
        modules: [
          defineNuxtModule({
            meta: { name: 'foo' },
            moduleDependencies: {
              'some-module': {},
              'non-existent-module': { optional: true },
            },
          }),
        ],
      },
    })

    expect(globalThis.someModuleLoaded).toBe(1)
  })

  it('should not install modules that are already installed by the user', async () => {
    nuxt = await loadNuxt({
      cwd: tempDir,
      overrides: {
        modules: [
          defineNuxtModule({
            meta: { name: 'some-module' },
          }),
          defineNuxtModule({
            meta: { name: 'foo' },
            moduleDependencies: {
              'some-module': {},
            },
          }),
        ],
      },
    })

    expect(globalThis.someModuleLoaded).toBeUndefined()
  })

  it('should not load a module from disk if it is present inline', async () => {
    nuxt = await loadNuxt({
      cwd: tempDir,
      overrides: {
        modules: [
          defineNuxtModule({
            meta: { name: 'foo' },
            moduleDependencies: {
              'some-module': {},
            },
          }),
          'some-module',
        ],
      },
    })

    expect(globalThis.someModuleLoaded).toBe(1)
  })

  it('should merge options as expected', async () => {
    nuxt = await loadNuxt({
      cwd: tempDir,
      overrides: {
        // @ts-expect-error untyped nuxt options
        a: {
          user: 'provided by user',
        },
        modules: [
          defineNuxtModule({
            meta: { name: 'a' },
            defaults: {
              value: 'provided by a',
              user: 'provided by a',
              default: 'provided by a',
            },
            setup (options) {
              expect(options).toMatchInlineSnapshot(`
                {
                  "default": "provided by c",
                  "user": "provided by user",
                  "value": "provided by c",
                }
              `)
            },
          }),
          defineNuxtModule({
            meta: { name: 'b' },
            setup (options) {
              expect(options).toMatchInlineSnapshot(`
                {
                  "default": "provided by c",
                  "value": "provided by c",
                }
              `)
            },
          }),
          defineNuxtModule({
            meta: { name: 'c' },
            setup (options) {
              expect(options).toMatchInlineSnapshot(`{}`)
            },
            moduleDependencies: {
              'a': {
                overrides: {
                  value: 'provided by c',
                },
                defaults: {
                  user: 'provided by c',
                  default: 'provided by c',
                },
              },
              'b': {
                overrides: {
                  value: 'provided by c',
                },
                defaults: {
                  default: 'provided by c',
                },
              },
            },
          }),
          defineNuxtModule({
            meta: { name: 'd' },
            setup (options) {
              expect(options).toMatchInlineSnapshot(`{}`)
            },
            moduleDependencies: {
              'b': {
                overrides: {
                  value: 'provided by d',
                },
                defaults: {
                  default: 'provided by d',
                },
              },
            },
          }),
        ],
      },
    })

    // @ts-expect-error untyped nuxt option
    expect(nuxt.options.a).toMatchInlineSnapshot(`
      {
        "default": "provided by c",
        "user": "provided by user",
        "value": "provided by c",
      }
    `)
    // @ts-expect-error untyped nuxt option
    expect(nuxt.options.b).toMatchInlineSnapshot(`
      {
        "default": "provided by c",
        "value": "provided by c",
      }
    `)
    // @ts-expect-error untyped nuxt option
    expect(nuxt.options.c).toMatchInlineSnapshot(`undefined`)
    // @ts-expect-error untyped nuxt option
    expect(nuxt.options.d).toMatchInlineSnapshot(`undefined`)
  })

  it('should warn if version constraints do not match', async () => {
    await expect(loadNuxt({
      cwd: tempDir,
      overrides: {
        modules: [
          defineNuxtModule({
            meta: { name: 'foo' },
            moduleDependencies: {
              'some-module': {
                version: '>=2',
              },
            },
          }),
        ],
      },
    })).rejects.toThrowErrorMatchingInlineSnapshot(`[TypeError: Module \`some-module\` version (\`1.0.0\`) does not satisfy \`>=2\` (requested by a module in \`nuxt.options\`).]`)
  })

  it('should apply moduleDependencies config when installModule is called explicitly', async () => {
    const setupOrder: string[] = []

    nuxt = await loadNuxt({
      cwd: tempDir,
      overrides: {
        // @ts-expect-error no types for someModule
        someModule: {
          value: 'from user',
          moduleOverride: 'from user',
          userDefault: 'from user',
        },
        modules: [
          // Module A defines config for module C via moduleDependencies
          defineNuxtModule({
            meta: { name: 'module-a' },
            moduleDependencies: {
              'someModule': {
                optional: true,
                overrides: {
                  value: 'from module-a override',
                  moduleOverride: 'from module-a',
                },
                defaults: {
                  defaultValue: 'from module-a default',
                  userDefault: 'from module-a default',
                },
              },
            },
            setup () {
              setupOrder.push('module-a')
            },
          }),
          // Module B calls installModule on module C
          defineNuxtModule({
            meta: { name: 'module-b' },
            async setup (_, nuxt) {
              setupOrder.push('module-b')

              // eslint-disable-next-line @typescript-eslint/no-deprecated
              await installModule('some-module', {
                value: 'from module-b',
                inlineValue: 'from module-b inline',
              }, nuxt)
            },
          }),
        ],
      },
    })

    expect(setupOrder).toEqual(['module-a', 'module-b'])
    expect(globalThis.someModuleLoaded).toBe(1)

    expect(globalThis.someModuleOptions).toMatchObject({
      // `installModule` should always override values
      value: 'from module-b',
      // extra values should be passed alone
      inlineValue: 'from module-b inline',
      // modules should be able to set default values
      defaultValue: 'from module-a default',
      // modules should be able to override user configuration
      moduleOverride: 'from module-a',
      // user configuration should be merged in
      userDefault: 'from user',
    })
  })
})

declare global {
  var someModuleLoaded: number | undefined
  var someModuleOptions: Record<string, any> | undefined
}
