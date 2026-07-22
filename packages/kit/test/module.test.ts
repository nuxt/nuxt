import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { appendFileSync } from 'node:fs'

import type { Nuxt } from 'nuxt/schema'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { join } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import { read as readRc, write as writeRc } from 'rc9'

import { defineNuxtModule, installModule, loadNuxt, loadNuxtModuleInstance } from '../src/index.ts'

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

  it('should resolve moduleDependencies provided as async functions', async () => {
    nuxt = await loadNuxt({
      cwd: tempDir,
      overrides: {
        modules: [
          defineNuxtModule({
            meta: { name: 'foo' },
            async moduleDependencies () {
              await Promise.resolve()
              return {
                'some-module': {},
              }
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

  it('should resolve moduleDependencies by meta.name when it differs from package name', async () => {
    const depSetupFn = vi.fn()

    nuxt = await loadNuxt({
      cwd: tempDir,
      overrides: {
        modules: [
          // Module with meta.name that differs from any package path
          defineNuxtModule({
            meta: { name: 'my-custom-name' },
            setup: depSetupFn,
          }),
          // Module that depends on the above by meta.name
          defineNuxtModule({
            meta: { name: 'consumer' },
            moduleDependencies: {
              'my-custom-name': {},
            },
          }),
        ],
      },
    })

    // The dependency module should have been found (not re-installed) via meta.name lookup
    expect(depSetupFn).toHaveBeenCalledTimes(1)
  })

  it('should resolve moduleDependencies by meta.name and apply overrides/defaults', async () => {
    nuxt = await loadNuxt({
      cwd: tempDir,
      overrides: {
        // @ts-expect-error untyped nuxt option
        localMod: {
          user: 'provided by user',
        },
        modules: [
          defineNuxtModule({
            meta: { name: 'local-module', configKey: 'localMod' },
            defaults: {
              value: 'default',
              user: 'default',
              fromDefault: 'default',
            },
            setup (options) {
              expect(options).toMatchObject({
                value: 'from override',
                user: 'provided by user',
                fromDefault: 'from consumer default',
              })
            },
          }),
          defineNuxtModule({
            meta: { name: 'consumer' },
            moduleDependencies: {
              'local-module': {
                overrides: {
                  value: 'from override',
                },
                defaults: {
                  fromDefault: 'from consumer default',
                  user: 'from consumer default',
                },
              },
            },
          }),
        ],
      },
    })

    // @ts-expect-error untyped nuxt option
    expect(nuxt.options.localMod).toMatchObject({
      value: 'from override',
      user: 'provided by user',
      fromDefault: 'from consumer default',
    })
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

describe('loadNuxtModuleInstance error surfacing', { sequential: true }, () => {
  let nuxt: Nuxt

  const tempDir = join(repoRoot, 'node_modules/.temp/module-load-errors')

  function loadError (module: string) {
    return loadNuxtModuleInstance(module, nuxt).then(
      () => { throw new Error(`expected \`${module}\` to fail loading`) },
      (error: Error & { cause?: unknown }) => error,
    )
  }

  beforeAll(async () => {
    // start from a clean slate so a crashed prior run can't leave stale fixtures behind
    await rm(tempDir, { recursive: true, force: true })

    // installed, resolves fine, but throws during evaluation
    const throwingModule = join(tempDir, 'node_modules/throwing-module')
    await mkdir(throwingModule, { recursive: true })
    await writeFile(join(throwingModule, 'package.json'), JSON.stringify({ name: 'throwing-module', version: '1.0.0', type: 'module', exports: './index.js' }))
    await writeFile(join(throwingModule, 'index.js'), `throw new Error('boom from inside the module')\n`)

    // entrypoint imports a dependency that does not exist
    const brokenDepModule = join(tempDir, 'node_modules/broken-dep-module')
    await mkdir(brokenDepModule, { recursive: true })
    await writeFile(join(brokenDepModule, 'package.json'), JSON.stringify({ name: 'broken-dep-module', version: '1.0.0', type: 'module', exports: './index.js' }))
    await writeFile(join(brokenDepModule, 'index.js'), `import 'this-dependency-does-not-exist'\nexport default () => {}\n`)

    // installed dependency that only exports its main entry
    const depWithExports = join(tempDir, 'node_modules/dep-with-exports')
    await mkdir(depWithExports, { recursive: true })
    await writeFile(join(depWithExports, 'package.json'), JSON.stringify({ name: 'dep-with-exports', version: '1.0.0', type: 'module', exports: { '.': './index.js' } }))
    await writeFile(join(depWithExports, 'index.js'), `export default () => {}\n`)

    // installed and loads fine, but its default export is not a function
    const nonFunctionModule = join(tempDir, 'node_modules/non-function-module')
    await mkdir(nonFunctionModule, { recursive: true })
    await writeFile(join(nonFunctionModule, 'package.json'), JSON.stringify({ name: 'non-function-module', version: '1.0.0', type: 'module', exports: './index.js' }))
    await writeFile(join(nonFunctionModule, 'index.js'), `export default {}\n`)

    // entrypoint imports a non-exported subpath, throwing ERR_PACKAGE_PATH_NOT_EXPORTED at import time
    const subpathModule = join(tempDir, 'node_modules/subpath-module')
    await mkdir(subpathModule, { recursive: true })
    await writeFile(join(subpathModule, 'package.json'), JSON.stringify({ name: 'subpath-module', version: '1.0.0', type: 'module', exports: './index.js' }))
    await writeFile(join(subpathModule, 'index.js'), `import 'dep-with-exports/not-exported'\nexport default () => {}\n`)

    nuxt = await loadNuxt({ cwd: tempDir })
  })

  afterAll(async () => {
    await nuxt?.close()
    await rm(tempDir, { recursive: true, force: true })
  })

  it('surfaces the real error when an installed module throws during evaluation', async () => {
    const error = await loadError('throwing-module')
    expect(error.message).toMatch(/An error occurred while importing the module/)
    expect(error.message).not.toMatch(/may not be installed/)
    expect((error.cause as Error)?.message).toMatch(/boom from inside the module/)
  })

  it('surfaces a missing sub-dependency rather than reporting the module as missing', async () => {
    const error = await loadError('broken-dep-module')
    expect(error.message).toMatch(/this-dependency-does-not-exist/)
    expect(error.message).not.toMatch(/may not be installed/)
    expect(error.cause).toBeInstanceOf(Error)
  })

  it('surfaces a non-exported dependency subpath rather than reporting the module as missing', async () => {
    const error = await loadError('subpath-module')
    expect(error.message).toMatch(/An error occurred while importing the module/)
    expect(error.message).not.toMatch(/may not be installed/)
    expect(error.cause).toBeInstanceOf(Error)
  })

  it('reports a module whose default export is not a function', async () => {
    const error = await loadError('non-function-module')
    expect(error.message).toMatch(/is not a function/)
    expect(error.message).not.toMatch(/may not be installed/)
  })

  it('reports a genuinely missing module as not installed', async () => {
    const error = await loadError('this-module-is-not-installed')
    expect(error.message).toMatch(/may not be installed/)
    expect(error.cause).toBeInstanceOf(Error)
  })
})

declare global {
  var someModuleLoaded: number | undefined
  var someModuleOptions: Record<string, any> | undefined
}
