import { readFile, rm, symlink } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveModulePath } from 'exsolve'
import { join } from 'pathe'
import { exec } from 'tinyexec'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { shouldReportJitiFallbackOnce } from '../src/internal/jiti.ts'
import { createTempDir, writeFiles } from './utils.ts'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const kitEntry = pathToFileURL(join(repoRoot, 'packages/kit/src/index.ts')).href
const jitiInternal = pathToFileURL(join(repoRoot, 'packages/kit/src/internal/jiti.ts')).href

/** Makes `jiti` unreachable entirely, shared with the `no-jiti` test project. */
const BLOCK_ALL = pathToFileURL(join(repoRoot, 'test/no-jiti/block-jiti-loader.mjs')).href

/**
 * Makes the bare specifier `jiti` unresolvable while still allowing it to be loaded by absolute
 * path, standing in for a layout where `jiti` is present in the project but not linked as a peer
 * dependency of `@nuxt/kit`.
 */
const BLOCK_BARE = `export function resolve (specifier, context, next) {
  if (specifier === 'jiti') { throw new Error('jiti is unavailable') }
  return next(specifier, context)
}`

// The runners execute in a plain node process: under the test runner's module loader the imports
// are resolved by vite and never reach the runtime paths being tested.
const CLASSIFY = `const [entry, target] = process.argv.slice(-2)
const { isLoaderError, getMissingCjsGlobal } = await import(entry)
try {
  await import(target)
  console.log(JSON.stringify({ imported: true }))
} catch (error) {
  console.log(JSON.stringify({ code: error.code, isLoaderError: isLoaderError(error), missingCjsGlobal: getMissingCjsGlobal(error) ?? null }))
}`

const LOAD = `const { hook, cwd, config, module: id, alias = {}, loads = 1 } = JSON.parse(process.argv.at(-1))
if (hook) { (await import('node:module')).register(hook) }
const kit = await import(${JSON.stringify(kitEntry)})
const result = { ok: true }
try {
  if (config) {
    result.value = (await kit.loadNuxtConfig({ cwd })).runtimeConfig?.value ?? null
  }
  if (id) {
    const nuxt = { options: { rootDir: cwd, alias, modulesDir: [cwd + '/node_modules'] } }
    for (let i = 0; i < loads; i++) {
      result.module = typeof (await kit.loadNuxtModuleInstance(id, nuxt)).nuxtModule
    }
  }
  console.log(JSON.stringify(result))
} catch (error) {
  console.log(JSON.stringify({ ok: false, code: error.code, message: error.message, fix: error.fix }))
}`

interface LoadOptions {
  cwd: string
  hook?: string
  config?: boolean
  module?: string
  alias?: Record<string, string>
  loads?: number
}

interface LoadResult { ok: boolean, value?: unknown, module?: string, code?: string, message?: string, fix?: string, logs: string }

async function runNode (script: string, args: string[], cwd: string) {
  const { stdout, stderr } = await exec(process.execPath, ['--input-type=module', '-e', script, '--', ...args], { nodeOptions: { cwd } })
  const line = stdout.trim().split('\n').at(-1)
  if (!line) {
    throw new Error(`no output: ${stderr}`)
  }
  return { ...JSON.parse(line), logs: stdout + stderr }
}

function load (options: LoadOptions): Promise<LoadResult> {
  return runNode(LOAD, [JSON.stringify(options)], options.cwd)
}

const USES_DIRNAME = `export default { runtimeConfig: { value: __dirname ? 'ok' : 'no' } }\n`

// Throws a different message on each evaluation, so a retry is distinguishable from a single run
const COUNTED_THROW = `import { appendFileSync, readFileSync } from 'node:fs'
const log = new URL('./runs.log', import.meta.url)
appendFileSync(log, '.')
throw new Error(\`run \${readFileSync(log, 'utf-8').length}\`)
`

describe('jiti fallback', { concurrent: false, timeout: 60_000 }, () => {
  let dir: string
  let blockBare: string

  beforeAll(async () => {
    dir = await createTempDir('kit-loader-error-')
    blockBare = pathToFileURL(join(dir, 'block-bare.mjs')).href
    await writeFiles(dir, {
      'package.json': { name: 'loader-error-fixture', private: true, type: 'module' },
      'block-bare.mjs': BLOCK_BARE,
      'nested.ts': 'export const nested = 1\n',
      'extensionless-import.ts': 'import { nested } from \'./nested\'\nexport default () => nested\n',
      'json-import.ts': 'import pkg from \'./package.json\'\nexport default () => pkg\n',
      'throws.ts': 'throw new Error(\'boom\')\n',
      'dirname.ts': 'const here = __dirname\nexport default () => here\n',
      'requires.ts': 'const pkg = require(\'./package.json\')\nexport default () => pkg\n',
      'unrelated-reference.ts': 'export default () => 1\nmy__dirname\n',
      'alias-import.ts': 'import { nested } from \'#shared/nested.ts\'\nexport default () => nested\n',
      'node_modules/ts-module/package.json': { name: 'ts-module', type: 'module' },
      'node_modules/ts-module/index.ts': 'const value: number = 1\nexport default () => value\n',
    })
  })

  afterAll(() => rm(dir, { force: true, recursive: true }))

  const loadModule = (file: string, options: Omit<LoadOptions, 'cwd' | 'module'> = {}) => load({ cwd: dir, module: join(dir, file), ...options })

  async function loadConfig (name: string, source: string, { pkg = {}, nuxtDependencies, hook }: { pkg?: Record<string, unknown>, nuxtDependencies?: Record<string, string>, hook?: string } = {}) {
    const cwd = join(dir, 'configs', name)
    await writeFiles(cwd, {
      'package.json': { name: `config-${name}`, private: true, type: 'module', ...pkg },
      'nuxt.config.ts': source,
      ...nuxtDependencies && { 'node_modules/nuxt/package.json': { name: 'nuxt', version: '4.0.0', dependencies: nuxtDependencies } },
    })
    return { cwd, ...await load({ cwd, config: true, hook }) }
  }

  it.each([
    ['extensionless-import.ts', { code: 'ERR_MODULE_NOT_FOUND', isLoaderError: true, missingCjsGlobal: null }],
    ['json-import.ts', { code: 'ERR_IMPORT_ATTRIBUTE_MISSING', isLoaderError: true, missingCjsGlobal: null }],
    ['alias-import.ts', { code: 'ERR_PACKAGE_IMPORT_NOT_DEFINED', isLoaderError: true, missingCjsGlobal: null }],
    ['throws.ts', { isLoaderError: false, missingCjsGlobal: null }],
    ['dirname.ts', { isLoaderError: false, missingCjsGlobal: '__dirname' }],
    ['requires.ts', { isLoaderError: false, missingCjsGlobal: 'require' }],
    ['unrelated-reference.ts', { isLoaderError: false, missingCjsGlobal: null }],
  ])('should classify the native import failure of %s', async (file, expected) => {
    const target = pathToFileURL(join(dir, file)).href
    const result = await runNode(CLASSIFY, [jitiInternal, target], dir)
    expect({ ...result, logs: undefined }).toStrictEqual({ ...expected, logs: undefined })
  })

  it.each([
    ['extensionless-import.ts', 'import `nested.ts` rather than `nested`'],
    ['json-import.ts', 'with { type: \'json\' }'],
    ['alias-import.ts', 'Use a relative import'],
  ])('should load %s through jiti and tell the user how to load it natively', async (file, hint) => {
    const result = await loadModule(file, { alias: { '#shared/': dir + '/' } })
    expect(result).toMatchObject({ ok: true, module: 'function' })
    expect(result.logs).toContain('NUXT_B8023')
    expect(result.logs).toContain(hint)
    expect(result.logs).toMatch(/add -D jiti|install -D jiti|i -D jiti/)
  })

  it('should load a module using `__dirname` through jiti, warning once per process', async () => {
    const result = await loadModule('dirname.ts', { loads: 3 })
    expect(result).toMatchObject({ ok: true, module: 'function' })
    expect(result.logs.match(/NUXT_B8023/g)).toHaveLength(1)
    expect(result.logs).toContain('__dirname is not defined')
  })

  it('should load a module using `require` through jiti', async () => {
    await expect(loadModule('requires.ts')).resolves.toMatchObject({ ok: true, module: 'function' })
  })

  it('should only point at the module author for an installed module', async () => {
    expect((await loadModule('node_modules/ts-module/index.ts')).logs).toContain('Report it to the module author')
    expect((await loadModule('extensionless-import.ts')).logs).not.toContain('module author')
  })

  it('should not warn when a module loads natively', async () => {
    expect((await loadModule('nested.ts')).logs).not.toContain('NUXT_B8023')
  })

  it('should not retry a module that threw an unrelated ReferenceError', async () => {
    const result = await loadModule('unrelated-reference.ts')
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/my__dirname is not defined/)
    expect(result.logs).not.toContain('NUXT_B8023')
  })

  it('should report the module\'s own error rather than retrying it', async () => {
    const result = await loadModule('throws.ts')
    expect(result).toMatchObject({ ok: false, code: 'NUXT_B8018' })
    expect(result.message).toMatch(/boom/)
  })

  it('should explain a missing CJS global when jiti cannot be loaded', async () => {
    const result = await loadModule('dirname.ts', { hook: blockBare })
    expect(result).toMatchObject({ ok: false, code: 'NUXT_B8020' })
    expect(result.fix).toMatch(/does not provide the CommonJS globals/)
    expect(result.fix).toMatch(/import\.meta\.dirname/)
    expect(result.fix).toMatch(/jiti/)
  })

  it('should retry any config file failure through jiti and warn', async () => {
    const result = await loadConfig('cjs-globals', USES_DIRNAME)
    expect(result).toMatchObject({ ok: true, value: 'ok' })
    expect(result.logs).toContain('NUXT_B5023')
  })

  it('should retry a config file using `require`', async () => {
    const result = await loadConfig('own-error', 'const { format } = require(\'node:util\')\nexport default { runtimeConfig: { value: format(\'%s-%s\', \'a\', \'b\') } }\n')
    expect(result).toMatchObject({ ok: true, value: 'a-b' })
  })

  it('should retry a config file that threw for its own reasons, but report its first error', async () => {
    const result = await loadConfig('always-throws', COUNTED_THROW)
    expect(result).toMatchObject({ ok: false, message: 'run 1' })
    expect(result.code).toBeUndefined()
    expect(result.logs).not.toContain('NUXT_B5023')
    await expect(readFile(join(result.cwd, 'runs.log'), 'utf-8')).resolves.toBe('..')
  })

  it('should not reach for jiti at all when a config file threw for its own reasons', async () => {
    const result = await loadConfig('own-bug-no-jiti', COUNTED_THROW, { hook: blockBare })
    expect(result).toMatchObject({ ok: false, message: 'run 1' })
    expect(result.code).toBeUndefined()
    expect(result.logs).not.toContain('jiti')
    await expect(readFile(join(result.cwd, 'runs.log'), 'utf-8')).resolves.toBe('.')
  })

  it('should surface a distinct jiti failure rather than the missing global', async () => {
    const result = await loadConfig('distinct-under-jiti', 'const here = __dirname\nthrow new Error(`threw under jiti from ${typeof here}`)\n')
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/threw under jiti from string/)
    expect(result.message).not.toMatch(/__dirname/)
  })

  it('should not report a fallback for a Nuxt 4 project, whose nuxt depends on jiti', async () => {
    const cwd = join(dir, 'configs/nuxt-4')
    await writeFiles(cwd, { 'node_modules/nuxt/package.json': { name: 'nuxt', version: '4.0.0', dependencies: { jiti: '^2.7.0' } } })
    expect(shouldReportJitiFallbackOnce(join(cwd, 'nuxt.config.ts'), cwd, 4)).toBe(false)
    expect(shouldReportJitiFallbackOnce(join(cwd, 'nuxt.config.ts'), cwd, 5)).toBe(true)
  })

  it('should warn a project whose nuxt depends on jiti when loading its config', async () => {
    const result = await loadConfig('nuxt-4-config', `export default { future: { compatibilityVersion: 4 }, runtimeConfig: { value: __dirname ? 'ok' : 'no' } }\n`, { nuxtDependencies: { jiti: '^2.7.0' } })
    expect(result).toMatchObject({ ok: true, value: 'ok' })
    expect(result.logs).toContain('NUXT_B5023')
  })

  it('should warn a Nuxt 5 project that has not asked for jiti', async () => {
    const result = await loadConfig('nuxt-5', USES_DIRNAME, { nuxtDependencies: {} })
    expect(result).toMatchObject({ ok: true, value: 'ok' })
    expect(result.logs).toContain('NUXT_B5023')
    expect(result.logs).toContain('import.meta.dirname')
  })

  it('should not warn a Nuxt 5 project that installed jiti itself', async () => {
    const result = await loadConfig('nuxt-5-with-jiti', USES_DIRNAME, { pkg: { devDependencies: { jiti: '^2.7.0' } }, nuxtDependencies: {} })
    expect(result).toMatchObject({ ok: true, value: 'ok' })
    expect(result.logs).not.toContain('NUXT_B5023')
  })

  it('should tell a Nuxt 5 project without jiti how to load a config using CJS globals', async () => {
    const result = await loadConfig('nuxt-5-no-jiti', USES_DIRNAME, { nuxtDependencies: {}, hook: blockBare })
    expect(result.code).toBe('NUXT_B5021')
    expect(result.fix).toMatch(/import\.meta\.dirname/)
    expect(result.fix).toMatch(/jiti/)
  })

  it('should not warn when a config file loads natively', async () => {
    const result = await loadConfig('native', 'export default { runtimeConfig: { value: \'native\' } }\n')
    expect(result).toMatchObject({ ok: true, value: 'native' })
    expect(result.logs).not.toContain('NUXT_B5023')
  })
})

// `enum` is the cheapest syntax the runtime refuses to strip, so both the config and the module
// in the fixture can only be loaded through jiti.
describe('jiti resolution', { concurrent: false, timeout: 60_000 }, () => {
  // Created outside the repository on purpose: resolution walks up through `node_modules`, so a
  // fixture inside the workspace would find the repo's own `nuxt` and `jiti` and prove nothing.
  let tempDir: string
  let projectDir: string

  const installedJiti = join(resolveModulePath('jiti', { from: import.meta.url }), '../..')

  const run = (hook: string) => load({ cwd: projectDir, hook, config: true, module: 'enum-module' })

  beforeAll(async () => {
    tempDir = await createTempDir('nuxt-jiti-')
    projectDir = join(tempDir, 'project')
    await writeFiles(tempDir, {
      'block-bare.mjs': BLOCK_BARE,
      'project/package.json': { name: 'jiti-fixture', private: true, type: 'module' },
      'project/nuxt.config.ts': 'enum Marker { value }\nexport default { runtimeConfig: { value: Marker.value } }\n',
      'project/node_modules/enum-module/package.json': { name: 'enum-module', version: '1.0.0', type: 'module', exports: './index.ts' },
      'project/node_modules/enum-module/index.ts': 'enum Kind { a }\nexport default () => { void Kind.a }\n',
    })
  })

  afterAll(() => rm(tempDir, { recursive: true, force: true }))

  const blockBare = () => pathToFileURL(join(tempDir, 'block-bare.mjs')).href

  it('falls back to a project-level jiti when it is not resolvable from @nuxt/kit', async () => {
    const projectJiti = join(projectDir, 'node_modules/jiti')
    await symlink(installedJiti, projectJiti, 'dir')
    try {
      await expect(run(blockBare())).resolves.toMatchObject({ ok: true, value: 0, module: 'function' })
    } finally {
      await rm(projectJiti, { recursive: true, force: true })
    }
  })

  // A project depends on `nuxt`, not on what `nuxt` depends on, so under an isolated
  // `node_modules` the `jiti` that Nuxt 3 and 4 install is only reachable by hopping through the
  // `nuxt` package itself. This fixture reproduces that layout.
  it('falls back to the jiti that nuxt depends on', async () => {
    const store = join(projectDir, 'node_modules/.store/nuxt/node_modules')
    await writeFiles(store, {
      'nuxt/package.json': { name: 'nuxt', version: '4.5.1', type: 'module', main: 'index.mjs' },
      'nuxt/index.mjs': 'export default {}\n',
    })
    await symlink(installedJiti, join(store, 'jiti'), 'dir')
    await symlink(join(store, 'nuxt'), join(projectDir, 'node_modules/nuxt'), 'dir')
    try {
      await expect(run(blockBare())).resolves.toMatchObject({ ok: true, value: 0, module: 'function' })
    } finally {
      await rm(join(projectDir, 'node_modules/nuxt'), { recursive: true, force: true })
      await rm(join(projectDir, 'node_modules/.store'), { recursive: true, force: true })
    }
  })

  // Proves the two tests above exercise the fallbacks rather than passing because jiti happens to
  // be resolvable some other way.
  it('has nothing to fall back to once neither is present', async () => {
    await expect(run(blockBare())).resolves.toMatchObject({ ok: false, code: 'NUXT_B5017' })
  })

  it('reports how to install jiti when it cannot be found anywhere', async () => {
    const result = await run(BLOCK_ALL)
    expect(result).toMatchObject({ ok: false, code: 'NUXT_B5017' })
    expect(result.message).toMatch(/could not be loaded/)
  })
})
