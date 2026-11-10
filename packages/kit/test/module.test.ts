import { readFile, rm } from 'node:fs/promises'
import { appendFileSync } from 'node:fs'
import type { Nuxt, NuxtConfig } from '@nuxt/schema'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { join } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'
import { read as readRc, write as writeRc } from 'rc9'

import { defineNuxtModule, getNuxtModuleVersion, hasNuxtModule, hasNuxtModuleCompatibility, installModule, loadNuxt, loadNuxtModuleInstance } from '../src/index.ts'
import { fakePackage, writeFiles } from './utils.ts'

// inside the workspace, so that `loadNuxt` can resolve `nuxt`
const tempDir = join(await findWorkspaceDir(), 'node_modules/.temp/kit-module')

const NOOP = 'export default () => {}\n'

const recordEvaluation = (log: string, then: string) => [
  `import { appendFileSync } from 'node:fs'`,
  `appendFileSync(${JSON.stringify(join(tempDir, log))}, 'evaluated\\n')`,
  then,
  ``,
].join('\n')

const nestedDependency = (version: string) => fakePackage('nested-dependency', `
export default Object.assign((_options, nuxt) => {
  const previous = nuxt.options.runtimeConfig.nestedDependency
  nuxt.options.runtimeConfig.nestedDependency = {
    version: '${version}',
    message: nuxt.options.nestedDependency.message,
    calls: (previous?.calls || 0) + 1
  }
}, {
  getMeta: () => ({ name: 'nested-dependency', configKey: 'nestedDependency' })
})`, { version })

const parentModule = fakePackage('parent-module', `
export default Object.assign(() => {}, {
  getMeta: () => ({ name: 'parent-module' }),
  getModuleDependencies: () => ({
    'nested-dependency': { version: '>=2', defaults: { message: 'configured' } }
  })
})`)

function prefixed (prefix: string, files: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(files).map(([path, contents]) => [join(prefix, path), contents])) as Parameters<typeof writeFiles>[1]
}

beforeAll(async () => {
  // start from a clean slate so a crashed prior run can't leave stale fixtures behind
  await rm(tempDir, { recursive: true, force: true })
  await writeFiles(tempDir, {
    'lifecycle/.keep': '',
    'local-module.mjs': NOOP,
    ...fakePackage('named-module', NOOP),
    ...fakePackage('versioned-module', NOOP),
    'node_modules/versioned-module/module.json': { version: '2.0.0' },
    ...fakePackage('some-module', `
export default Object.assign((options) => {
  globalThis.someModuleLoaded ||= 0
  globalThis.someModuleLoaded++
  globalThis.someModuleOptions = options
}, {
  getMeta: () => ({ configKey: 'someModule' })
})`),
    ...fakePackage('prerelease-module', `export default Object.assign(() => {}, { getMeta: () => ({ name: 'prerelease-module' }) })`, { version: '2.0.0-beta.1' }),
    // installed, resolves fine, but throws during evaluation
    ...fakePackage('throwing-module', `throw new Error('boom from inside the module')\n`),
    // records each evaluation before throwing, so a retry through another loader is observable
    ...fakePackage('side-effect-module', recordEvaluation('evaluations', `throw new Error('boom after a side effect')`)),
    // the runtime raises a bare `SyntaxError` for a file it cannot parse and for one that misuses
    // `JSON.parse`, so this records its evaluation to prove the two are not conflated
    ...fakePackage('runtime-syntax-module', recordEvaluation('syntax-evaluations', `JSON.parse('{')`)),
    ...fakePackage('dynamic-import-module', recordEvaluation('dynamic-evaluations', `await import('this-dependency-does-not-exist')`)),
    ...fakePackage('broken-dep-module', `import 'this-dependency-does-not-exist'\n${NOOP}`),
    ...fakePackage('dep-with-exports', NOOP, { exports: { '.': './index.js' } }),
    // imports a non-exported subpath, throwing ERR_PACKAGE_PATH_NOT_EXPORTED at import time
    ...fakePackage('subpath-module', `import 'dep-with-exports/not-exported'\n${NOOP}`),
    ...fakePackage('non-function-module', `export default {}\n`),
    ...fakePackage('esm-module', NOOP),
    // CommonJS marked as transpiled ESM, so the default export is nested behind `__esModule`
    ...fakePackage('cjs-interop-module', `exports.__esModule = true\nexports.default = () => {}\n`, { type: 'commonjs', exports: './index.cjs' }),
    ...fakePackage('ts-module', `const mod = (): void => {}\nexport default mod\n`, { exports: './index.ts' }),
    ...prefixed('nested-deps/nested', { ...parentModule, ...prefixed('node_modules/parent-module', nestedDependency('2.0.0')) }),
    ...prefixed('nested-deps/app', { ...parentModule, ...prefixed('node_modules/parent-module', nestedDependency('2.0.0')), ...nestedDependency('3.0.0') }),
    ...prefixed('nested-deps/incompatible', { ...parentModule, ...prefixed('node_modules/parent-module', nestedDependency('2.0.0')), ...nestedDependency('1.0.0') }),
    ...prefixed('nested-deps/hoisted', { ...parentModule, ...nestedDependency('3.0.0') }),
  })
})

afterAll(() => rm(tempDir, { recursive: true, force: true }))

let nuxt: Nuxt | undefined

afterEach(async () => {
  await nuxt?.close()
  nuxt = undefined
})

describe('module lifecycle hooks', { concurrent: false }, () => {
  const cwd = join(tempDir, 'lifecycle')
  const hooksLogFile = join(cwd, 'hooks-logs')

  const testModule = defineNuxtModule({
    meta: { name: 'test-module', version: '1.0.0' },
    onInstall () { appendFileSync(hooksLogFile, 'install\n') },
    onUpgrade () { appendFileSync(hooksLogFile, 'upgrade\n') },
  })

  async function install (previousVersion?: string) {
    await rm(hooksLogFile, { force: true })
    await rm(join(cwd, '.nuxtrc'), { force: true })
    if (previousVersion) {
      writeRc({ setups: { 'test-module': previousVersion } }, { dir: cwd, name: '.nuxtrc' })
    }
    nuxt = await loadNuxt({ cwd })
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    await installModule(testModule, {}, nuxt)
    const logs = await readFile(hooksLogFile, 'utf8').catch(() => '')
    return { logs: logs.split('\n').slice(0, -1), setup: readRc({ dir: cwd, name: '.nuxtrc' }).setups['test-module'] }
  }

  it.each([
    ['runs onInstall when a module is added', undefined, ['install']],
    ['runs onInstall only once', '1.0.0', []],
    ['runs onUpgrade when a module is upgraded', '0.1.0', ['upgrade']],
  ])('%s', async (_, previousVersion, logs) => {
    await expect(install(previousVersion)).resolves.toEqual({ logs, setup: '1.0.0' })
  })
})

describe('module dependencies', { concurrent: false }, () => {
  beforeEach(() => {
    delete globalThis.someModuleLoaded
    delete globalThis.someModuleOptions
  })

  const load = async (modules: NuxtConfig['modules'], overrides: Record<string, unknown> = {}) => {
    nuxt = await loadNuxt({ cwd: tempDir, overrides: { ...overrides, modules } })
    return nuxt
  }

  it('should install modules that are not marked as optional', async () => {
    await load([defineNuxtModule({
      meta: { name: 'foo' },
      moduleDependencies: { 'some-module': {}, 'non-existent-module': { optional: true } },
    })])
    expect(globalThis.someModuleLoaded).toBe(1)
  })

  it('should resolve moduleDependencies provided as async functions', async () => {
    await load([defineNuxtModule({
      meta: { name: 'foo' },
      async moduleDependencies () {
        await Promise.resolve()
        return { 'some-module': {} }
      },
    })])
    expect(globalThis.someModuleLoaded).toBe(1)
  })

  it('should not install modules that are already installed by the user', async () => {
    await load([
      defineNuxtModule({ meta: { name: 'some-module' } }),
      defineNuxtModule({ meta: { name: 'foo' }, moduleDependencies: { 'some-module': {} } }),
    ])
    expect(globalThis.someModuleLoaded).toBeUndefined()
  })

  it('should not load a module from disk if it is present inline', async () => {
    await load([
      defineNuxtModule({ meta: { name: 'foo' }, moduleDependencies: { 'some-module': {} } }),
      'some-module',
    ])
    expect(globalThis.someModuleLoaded).toBe(1)
  })

  it('should resolve moduleDependencies by meta.name when it differs from package name', async () => {
    const setup = vi.fn()
    await load([
      defineNuxtModule({ meta: { name: 'my-custom-name' }, setup }),
      defineNuxtModule({ meta: { name: 'consumer' }, moduleDependencies: { 'my-custom-name': {} } }),
    ])
    expect(setup).toHaveBeenCalledTimes(1)
  })

  it('should resolve moduleDependencies by meta.name and apply overrides/defaults', async () => {
    const setup = vi.fn()
    const nuxt = await load([
      defineNuxtModule({
        meta: { name: 'local-module', configKey: 'localMod' },
        defaults: { value: 'default', user: 'default', fromDefault: 'default' },
        setup,
      }),
      defineNuxtModule({
        meta: { name: 'consumer' },
        moduleDependencies: {
          'local-module': {
            overrides: { value: 'from override' },
            defaults: { fromDefault: 'from consumer default', user: 'from consumer default' },
          },
        },
      }),
    ], { localMod: { user: 'provided by user' } })

    const expected = { value: 'from override', user: 'provided by user', fromDefault: 'from consumer default' }
    expect(setup.mock.calls[0]![0]).toMatchObject(expected)
    expect((nuxt.options as unknown as Record<string, unknown>).localMod).toMatchObject(expected)
  })

  it('should merge options as expected', async () => {
    const setups = { a: vi.fn(), b: vi.fn(), c: vi.fn(), d: vi.fn() }
    const nuxt = await load([
      defineNuxtModule({
        meta: { name: 'a' },
        defaults: { value: 'provided by a', user: 'provided by a', default: 'provided by a' },
        setup: setups.a,
      }),
      defineNuxtModule({ meta: { name: 'b' }, setup: setups.b }),
      defineNuxtModule({
        meta: { name: 'c' },
        setup: setups.c,
        moduleDependencies: {
          a: { overrides: { value: 'provided by c' }, defaults: { user: 'provided by c', default: 'provided by c' } },
          b: { overrides: { value: 'provided by c' }, defaults: { default: 'provided by c' } },
        },
      }),
      defineNuxtModule({
        meta: { name: 'd' },
        setup: setups.d,
        moduleDependencies: {
          b: { overrides: { value: 'provided by d' }, defaults: { default: 'provided by d' } },
        },
      }),
    ], { a: { user: 'provided by user' } })

    const a = { default: 'provided by c', user: 'provided by user', value: 'provided by c' }
    const b = { default: 'provided by c', value: 'provided by c' }
    expect(Object.fromEntries(Object.entries(setups).map(([name, setup]) => [name, setup.mock.calls[0]![0]]))).toEqual({ a, b, c: {}, d: {} })
    expect(nuxt.options).toMatchObject({ a, b })
    expect(nuxt.options).not.toHaveProperty('c')
    expect(nuxt.options).not.toHaveProperty('d')
  })

  it.each([
    ['some-module', '>=2', /Module `some-module` version \(`1\.0\.0`\) does not satisfy `>=2` \(requested by a module in `nuxt.options`\)/],
    ['prerelease-module', '>=3', /Module `prerelease-module` version \(`2\.0\.0-beta\.1`\) does not satisfy `>=3`/],
  ])('should reject %s when its version does not satisfy %s', async (name, version, message) => {
    await expect(load([defineNuxtModule({ meta: { name: 'foo' }, moduleDependencies: { [name]: { version } } })])).rejects.toThrow(message)
  })

  it('accounts for prerelease versions in module dependencies', async () => {
    await expect(load([defineNuxtModule({ meta: { name: 'foo' }, moduleDependencies: { 'prerelease-module': { version: '>=1' } } })])).resolves.toBeDefined()
  })

  it('should apply moduleDependencies config when installModule is called explicitly', async () => {
    const setupOrder: string[] = []
    await load([
      defineNuxtModule({
        meta: { name: 'module-a' },
        moduleDependencies: {
          someModule: {
            optional: true,
            overrides: { value: 'from module-a override', moduleOverride: 'from module-a' },
            defaults: { defaultValue: 'from module-a default', userDefault: 'from module-a default' },
          },
        },
        setup () { setupOrder.push('module-a') },
      }),
      defineNuxtModule({
        meta: { name: 'module-b' },
        async setup (_, nuxt) {
          setupOrder.push('module-b')
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          await installModule('some-module', { value: 'from module-b', inlineValue: 'from module-b inline' }, nuxt)
        },
      }),
    ], { someModule: { value: 'from user', moduleOverride: 'from user', userDefault: 'from user' } })

    expect(setupOrder).toEqual(['module-a', 'module-b'])
    expect(globalThis.someModuleLoaded).toBe(1)
    expect(globalThis.someModuleOptions).toMatchObject({
      // `installModule` always overrides values, and extra values are passed alone
      value: 'from module-b',
      inlineValue: 'from module-b inline',
      defaultValue: 'from module-a default',
      moduleOverride: 'from module-a',
      userDefault: 'from user',
    })
  })
})

describe('nested module dependencies', { concurrent: false }, () => {
  const load = async (scenario: string, modules: string[]) => {
    nuxt = await loadNuxt({ cwd: join(tempDir, 'nested-deps', scenario), overrides: { modules } })
    return nuxt.options.runtimeConfig.nestedDependency
  }

  it.each([
    ['loads a dependency available only from its parent module', 'nested', ['parent-module'], '2.0.0'],
    ['keeps an explicitly installed app dependency and applies its defaults once', 'app', ['nested-dependency', 'parent-module'], '3.0.0'],
    ['prefers the declaring module dependency over an incompatible app dependency', 'incompatible', ['parent-module'], '2.0.0'],
    ['loads the app dependency when the declaring module has no nested copy', 'hoisted', ['parent-module'], '3.0.0'],
  ])('%s', async (_, scenario, modules, version) => {
    await expect(load(scenario, modules)).resolves.toEqual({ version, message: 'configured', calls: 1 })
  })

  it.each([
    ['nested-dependency', 'parent-module'],
    ['parent-module', 'nested-dependency'],
  ])('rejects an explicitly installed incompatible app dependency: %j', async (...modules) => {
    await expect(load('incompatible', modules)).rejects.toThrow(/Module `nested-dependency` version \(`1\.0\.0`\) does not satisfy `>=2`/)
  })
})

describe('module install hooks', { concurrent: false }, () => {
  async function loadWithHooks (modules: NuxtConfig['modules'], register: (nuxt: Nuxt) => void) {
    nuxt = await loadNuxt({ cwd: tempDir, overrides: { modules }, ready: false })
    register(nuxt)
    await nuxt.ready()
    return nuxt
  }

  it('fires `module:before` and `module:done` for each module', async () => {
    const before: string[] = []
    const done: string[] = []
    await loadWithHooks(['named-module', defineNuxtModule({ meta: { name: 'inline-module' } })], (nuxt) => {
      nuxt.hook('module:before', ({ name }) => { before.push(name) })
      nuxt.hook('module:done', ({ name }) => { done.push(name) })
    })

    expect(before).toContain('named-module')
    expect(before).toContain('inline-module')
    expect(done).toEqual(before)
  })

  it('always provides a renderable name', async () => {
    const names: string[] = []
    await loadWithHooks(['./local-module.mjs', () => {}, function myNamedFunctionModule () {}], (nuxt) => {
      nuxt.hook('module:before', ({ name }) => { names.push(name) })
    })

    expect(names).toContain('./local-module.mjs')
    expect(names).toContain('myNamedFunctionModule')
    expect(names.every(Boolean)).toBe(true)
  })

  it('reports timings and entry path in `module:done`', async () => {
    const done: Array<{ name: string, setup?: number, entryPath?: string }> = []
    await loadWithHooks(['named-module'], (nuxt) => {
      nuxt.hook('module:done', ({ name, timings, entryPath }) => { done.push({ name, setup: timings.setup, entryPath }) })
    })

    expect(done.find(t => t.name === 'named-module')).toMatchObject({ setup: expect.any(Number), entryPath: 'named-module' })
  })

  it('keeps module-reported timings alongside the measured setup time', async () => {
    let timings: Record<string, number | undefined> | undefined
    const nuxt = await loadWithHooks([defineNuxtModule({
      meta: { name: 'reports-timings' },
      setup: () => ({ timings: { custom: 5, setup: 9999 } }),
    })], (nuxt) => {
      nuxt.hook('module:done', (mod) => {
        if (mod.name === 'reports-timings') { timings = mod.timings }
      })
    })

    expect(timings?.custom).toBe(5)
    expect(timings?.setup).not.toBe(9999)
    expect(nuxt.options._installedModules.find(m => m.meta.name === 'reports-timings')?.timings).toEqual(timings)
  })

  it('fires for modules installed via `installModule`', async () => {
    const names: string[] = []
    nuxt = await loadNuxt({ cwd: tempDir })
    nuxt.hook('module:before', ({ name }) => { names.push(name) })
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    await installModule('named-module', {}, nuxt)

    expect(names).toEqual(['named-module'])
  })
})

describe('module compatibility', () => {
  const fakeNuxt = (modules: unknown[] = [], installed: string[] = []) => ({
    options: { rootDir: tempDir, alias: {}, modulesDir: [join(tempDir, 'node_modules')], modules, _installedModules: installed.map(name => ({ meta: { name } })) },
  }) as unknown as Nuxt

  it('checks whether a module is installed or to be installed by name', () => {
    const nuxt = fakeNuxt(['named-module', ['module-with-options', { foo: 'bar' }]], ['installed-module'])
    expect(hasNuxtModule('installed-module', nuxt)).toBe(true)
    expect(hasNuxtModule('named-module', nuxt)).toBe(true)
    expect(hasNuxtModule('module-with-options', nuxt)).toBe(true)
    expect(hasNuxtModule('missing-module', nuxt)).toBe(false)
  })

  it('reads the version of a module instance', async () => {
    const module = defineNuxtModule({ meta: { name: 'nuxt-module-foo', version: '1.0.0' } })
    expect(await getNuxtModuleVersion(module, fakeNuxt())).toBe('1.0.0')
    expect(await hasNuxtModuleCompatibility(module, '^1.0.0', fakeNuxt())).toBe(true)
    expect(await hasNuxtModuleCompatibility(module, '^2.0.0', fakeNuxt())).toBe(false)
  })

  it('reads the version of a module yet to be installed on the given Nuxt instance', async () => {
    expect(await getNuxtModuleVersion('versioned-module', fakeNuxt(['versioned-module']))).toBe('2.0.0')
  })
})

describe('loadNuxtModuleInstance', { concurrent: false }, () => {
  let shared: Nuxt

  beforeAll(async () => {
    shared = await loadNuxt({ cwd: tempDir })
  })

  afterAll(() => shared.close())

  function loadError (module: string) {
    return loadNuxtModuleInstance(module, shared).then(
      () => { throw new Error(`expected \`${module}\` to fail loading`) },
      (error: Error & { cause?: unknown, fix?: string }) => error,
    )
  }

  const evaluations = async (log: string) => (await readFile(join(tempDir, log), 'utf8')).trim().split('\n')

  it('surfaces the real error when an installed module throws during evaluation', async () => {
    const error = await loadError('throwing-module')
    expect(error.message).toMatch(/An error occurred while importing the module/)
    expect(error.message).not.toMatch(/may not be installed/)
    expect((error.cause as Error)?.message).toMatch(/boom from inside the module/)
  })

  it('reports the first error from a module that throws at its top level', async () => {
    const error = await loadError('side-effect-module')
    expect(error.message).toMatch(/boom after a side effect/)
    expect(error.message).not.toMatch(/jiti/)
    // a module is a function Nuxt calls later, so the retry repeats no work of the module's own
    expect(await evaluations('evaluations')).toHaveLength(2)
  })

  it('reports the first error from a module that raises a runtime SyntaxError', async () => {
    const error = await loadError('runtime-syntax-module')
    expect(error.cause).toBeInstanceOf(SyntaxError)
    expect(await evaluations('syntax-evaluations')).toHaveLength(2)
  })

  it('retries a module whose top-level dynamic import fails to resolve', async () => {
    const error = await loadError('dynamic-import-module')
    expect(error.message).toMatch(/this-dependency-does-not-exist/)
    expect(error.message).not.toMatch(/may not be installed/)
    expect(await evaluations('dynamic-evaluations')).toHaveLength(2)
  })

  it.each([
    ['a missing sub-dependency', 'broken-dep-module', /this-dependency-does-not-exist/],
    ['a non-exported dependency subpath', 'subpath-module', /An error occurred while importing the module/],
  ])('surfaces %s rather than reporting the module as missing', async (_, module, message) => {
    const error = await loadError(module)
    expect(error.message).toMatch(message)
    expect(error.message).not.toMatch(/may not be installed/)
    expect(error.cause).toBeInstanceOf(Error)
  })

  it('reports a module whose default export is not a function', async () => {
    const error = await loadError('non-function-module')
    expect(error.message).toMatch(/is not a function/)
    expect(error.message).not.toMatch(/may not be installed/)
  })

  it('reports a genuinely missing module as not installed, using the project package manager', async () => {
    const error = await loadError('this-module-is-not-installed')
    expect(error.message).toMatch(/may not be installed/)
    expect(error.fix).toBe('Run `pnpm add --ignore-workspace-root-check this-module-is-not-installed` to install it.')
    expect(error.cause).toBeInstanceOf(Error)
  })

  it('does not suggest an install command for a missing local module path', async () => {
    const error = await loadError('./modules/does-not-exist')
    expect(error.message).toMatch(/may not be installed/)
    expect(error.fix).toBe('Check that the module path exists and points to a valid Nuxt module.')
  })

  it.each(['esm-module', 'cjs-interop-module', 'ts-module'])('loads %s', async (module) => {
    const { nuxtModule } = await loadNuxtModuleInstance(module, shared)
    expect(nuxtModule).toBeTypeOf('function')
  })
})

declare global {
  var someModuleLoaded: number | undefined
  var someModuleOptions: Record<string, any> | undefined
}
