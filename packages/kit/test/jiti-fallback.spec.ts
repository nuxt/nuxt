import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { join } from 'pathe'
import { exec } from 'tinyexec'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const kitEntry = join(repoRoot, 'packages/kit/src/index.ts')
const jitiInternal = pathToFileURL(join(repoRoot, 'packages/kit/src/internal/jiti.ts')).href

/**
 * Both runners execute in a plain node process: under the test runner's module loader the imports
 * below are resolved by vite and never reach the runtime paths being tested.
 */
const CLASSIFY = `const [entry, target] = process.argv.slice(-2)
const { isLoaderError, getMissingCjsGlobal } = await import(entry)
try {
  await import(target)
  console.log(JSON.stringify({ imported: true }))
} catch (error) {
  console.log(JSON.stringify({ code: error.code, isLoaderError: isLoaderError(error), missingCjsGlobal: getMissingCjsGlobal(error) ?? null }))
}`

const LOAD_CONFIG = `const [entry, cwd] = process.argv.slice(-2)
const kit = await import(entry)
try {
  const config = await kit.loadNuxtConfig({ cwd })
  console.log(JSON.stringify({ ok: true, value: config.runtimeConfig?.value ?? null }))
} catch (error) {
  console.log(JSON.stringify({ ok: false, code: error.code, message: error.message, fix: error.fix }))
}`

const LOAD_MODULE = `const [entry, cwd, id, options] = process.argv.slice(-4)
const kit = await import(entry)
const { alias, loads } = JSON.parse(options)
const nuxt = { options: { rootDir: cwd, alias, modulesDir: [cwd + '/node_modules'] } }
try {
  let nuxtModule
  for (let i = 0; i < loads; i++) {
    ;({ nuxtModule } = await kit.loadNuxtModuleInstance(id, nuxt))
  }
  console.log(JSON.stringify({ ok: true, module: typeof nuxtModule }))
} catch (error) {
  console.log(JSON.stringify({ ok: false, code: error.code, message: error.message, fix: error.fix }))
}`

const USES_DIRNAME = `export default { runtimeConfig: { value: __dirname ? 'ok' : 'no' } }\n`

// Throws a different message on each evaluation, so a retry is distinguishable from a single run
const COUNTED_THROW = `import { appendFileSync, readFileSync } from 'node:fs'
const log = new URL('./runs.log', import.meta.url)
appendFileSync(log, '.')
throw new Error(\`run \${readFileSync(log, 'utf-8').length}\`)
`

function output (stdout: string, stderr: string) {
  const line = stdout.trim().split('\n').at(-1)
  if (!line) {
    throw new Error(`no output: ${stderr}`)
  }
  return JSON.parse(line)
}

const BLOCK_JITI = `import { register } from 'node:module'
register('data:text/javascript,export async function resolve (specifier, context, next) { if (specifier === \\'jiti\\') { throw new Error(\\'jiti is unavailable\\') } return next(specifier, context) }')`

describe('jiti fallback', { sequential: true }, () => {
  let dir: string
  let blockJiti: string

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'kit-loader-error-'))
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'loader-error-fixture', private: true, type: 'module' }))
    await writeFile(join(dir, 'nested.ts'), 'export const nested = 1\n')
    await writeFile(join(dir, 'extensionless-import.ts'), 'import { nested } from \'./nested\'\nexport default () => nested\n')
    await writeFile(join(dir, 'json-import.ts'), 'import pkg from \'./package.json\'\nexport default () => pkg\n')
    await writeFile(join(dir, 'throws.ts'), 'throw new Error(\'boom\')\n')
    await writeFile(join(dir, 'dirname.ts'), 'const here = __dirname\nexport default () => here\n')
    await writeFile(join(dir, 'requires.ts'), 'const pkg = require(\'./package.json\')\nexport default () => pkg\n')
    await writeFile(join(dir, 'unrelated-reference.ts'), 'export default () => 1\nmy__dirname\n')
    await writeFile(join(dir, 'alias-import.ts'), 'import { nested } from \'#shared/nested.ts\'\nexport default () => nested\n')

    blockJiti = pathToFileURL(join(dir, 'block-jiti.mjs')).href
    await writeFile(join(dir, 'block-jiti.mjs'), BLOCK_JITI)

    await mkdir(join(dir, 'node_modules'), { recursive: true })
  })

  afterAll(() => rm(dir, { force: true, recursive: true }))

  async function classify (file: string) {
    const target = pathToFileURL(join(dir, file)).href
    const { stdout, stderr } = await exec(process.execPath, ['--input-type=module', '-e', CLASSIFY, '--', jitiInternal, target], {
      nodeOptions: { cwd: dir },
    })
    return output(stdout, stderr) as { imported?: boolean, code?: string, isLoaderError?: boolean }
  }

  async function loadModule (file: string, options: { alias?: Record<string, string>, loads?: number } = {}) {
    const args = JSON.stringify({ alias: {}, loads: 1, ...options })
    const { stdout, stderr } = await exec(process.execPath, ['--input-type=module', '-e', LOAD_MODULE, '--', kitEntry, dir, join(dir, file), args], {
      nodeOptions: { cwd: dir },
    })
    return { ...output(stdout, stderr), logs: stdout + stderr } as { ok: boolean, module?: string, code?: string, message?: string, logs: string }
  }

  async function loadConfig (cwd: string, args: string[] = []) {
    const { stdout, stderr } = await exec(process.execPath, ['--input-type=module', ...args, '-e', LOAD_CONFIG, '--', kitEntry, cwd], {
      nodeOptions: { cwd },
    })
    return { ...output(stdout, stderr), logs: stdout + stderr } as { ok: boolean, value?: string | null, code?: string, message?: string, fix?: string, logs: string }
  }

  function loadConfigWithoutJiti (cwd: string) {
    return loadConfig(cwd, ['--import', blockJiti])
  }

  async function configFixture (name: string, source: string, pkg: Record<string, unknown> = {}) {
    const cwd = join(dir, 'configs', name)
    await mkdir(cwd, { recursive: true })
    await writeFile(join(cwd, 'package.json'), JSON.stringify({ name: `config-${name}`, private: true, type: 'module', ...pkg }))
    await writeFile(join(cwd, 'nuxt.config.ts'), source)
    return cwd
  }

  async function installFakeNuxt (cwd: string, dependencies: Record<string, string>) {
    const nuxtDir = join(cwd, 'node_modules', 'nuxt')
    await mkdir(nuxtDir, { recursive: true })
    await writeFile(join(nuxtDir, 'package.json'), JSON.stringify({ name: 'nuxt', version: '4.0.0', dependencies }))
  }

  async function loadModuleWithoutJiti (file: string) {
    const { stdout, stderr } = await exec(process.execPath, ['--input-type=module', '--import', blockJiti, '-e', LOAD_MODULE, '--', kitEntry, dir, join(dir, file), JSON.stringify({ alias: {}, loads: 1 })], {
      nodeOptions: { cwd: dir },
    })
    return output(stdout, stderr) as { ok: boolean, code?: string, message?: string, fix?: string }
  }

  it('should classify an extensionless import within a natively loadable entry as a loader error', async () => {
    await expect(classify('extensionless-import.ts')).resolves.toStrictEqual({
      code: 'ERR_MODULE_NOT_FOUND',
      isLoaderError: true,
      missingCjsGlobal: null,
    })
  })

  it('should classify a JSON import without an import attribute as a loader error', async () => {
    await expect(classify('json-import.ts')).resolves.toStrictEqual({
      code: 'ERR_IMPORT_ATTRIBUTE_MISSING',
      isLoaderError: true,
      missingCjsGlobal: null,
    })
  })

  it('should not classify an error the file itself threw as a loader error', async () => {
    await expect(classify('throws.ts')).resolves.toStrictEqual({ isLoaderError: false, missingCjsGlobal: null })
  })

  it('should load a module whose nested import the runtime cannot resolve', async () => {
    await expect(loadModule('extensionless-import.ts')).resolves.toMatchObject({ ok: true, module: 'function' })
  }, 60_000)

  it('should load a module importing JSON without an import attribute', async () => {
    await expect(loadModule('json-import.ts')).resolves.toMatchObject({ ok: true, module: 'function' })
  }, 60_000)

  it('should name the missing CJS global without treating it as a loader error', async () => {
    await expect(classify('dirname.ts')).resolves.toStrictEqual({ isLoaderError: false, missingCjsGlobal: '__dirname' })
    await expect(classify('requires.ts')).resolves.toStrictEqual({ isLoaderError: false, missingCjsGlobal: 'require' })
  })

  it('should not classify an unrelated ReferenceError as a missing CJS global', async () => {
    await expect(classify('unrelated-reference.ts')).resolves.toStrictEqual({ isLoaderError: false, missingCjsGlobal: null })
  })

  it('should load a module using `__dirname` through jiti', async () => {
    await expect(loadModule('dirname.ts')).resolves.toMatchObject({ ok: true, module: 'function' })
  }, 60_000)

  it('should warn that a module was loaded through jiti', async () => {
    const result = await loadModule('dirname.ts')
    expect(result.logs).toContain('NUXT_B8023')
    expect(result.logs).toContain('__dirname is not defined')
  }, 60_000)

  it('should not warn when a module loads natively', async () => {
    const result = await loadModule('nested.ts')
    expect(result.logs).not.toContain('NUXT_B8023')
  }, 60_000)

  it('should warn about a module only once per process', async () => {
    const result = await loadModule('dirname.ts', { loads: 3 })
    expect(result).toMatchObject({ ok: true, module: 'function' })
    expect(result.logs.match(/NUXT_B8023/g)).toHaveLength(1)
  }, 60_000)

  it('should load a module using `require` through jiti', async () => {
    await expect(loadModule('requires.ts')).resolves.toMatchObject({ ok: true, module: 'function' })
  }, 60_000)

  it('should not retry a module that threw an unrelated ReferenceError', async () => {
    const result = await loadModule('unrelated-reference.ts')
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/my__dirname is not defined/)
    expect(result.logs).not.toContain('NUXT_B8023')
  }, 60_000)

  it('should classify an unresolved `#` alias as a loader error', async () => {
    await expect(classify('alias-import.ts')).resolves.toStrictEqual({
      code: 'ERR_PACKAGE_IMPORT_NOT_DEFINED',
      isLoaderError: true,
      missingCjsGlobal: null,
    })
  })

  it('should load a module importing a Nuxt alias the runtime cannot resolve', async () => {
    await expect(loadModule('alias-import.ts', { alias: { '#shared/': dir + '/' } })).resolves.toMatchObject({ ok: true, module: 'function' })
  }, 60_000)

  it('should retry any config file failure through jiti and warn', async () => {
    const cwd = await configFixture('cjs-globals', USES_DIRNAME)
    const result = await loadConfig(cwd)
    expect(result).toMatchObject({ ok: true, value: 'ok' })
    expect(result.logs).toContain('NUXT_B5023')
  }, 60_000)

  it('should retry a config file using `require`', async () => {
    const cwd = await configFixture('own-error', 'const { format } = require(\'node:util\')\nexport default { runtimeConfig: { value: format(\'%s-%s\', \'a\', \'b\') } }\n')
    await expect(loadConfig(cwd)).resolves.toMatchObject({ ok: true, value: 'a-b' })
  }, 60_000)

  it('should retry a config file that threw for its own reasons, but report its first error', async () => {
    const cwd = await configFixture('always-throws', COUNTED_THROW)
    const result = await loadConfig(cwd)
    expect(result.ok).toBe(false)
    expect(result.message).toBe('run 1')
    expect(result.code).toBeUndefined()
    expect(result.logs).not.toContain('NUXT_B5023')
    await expect(readFile(join(cwd, 'runs.log'), 'utf-8')).resolves.toBe('..')
  }, 60_000)

  it('should not reach for jiti at all when a config file threw for its own reasons', async () => {
    const cwd = await configFixture('own-bug-no-jiti', COUNTED_THROW)
    const result = await loadConfigWithoutJiti(cwd)
    expect(result.ok).toBe(false)
    expect(result.message).toBe('run 1')
    expect(result.code).toBeUndefined()
    expect(result.logs).not.toContain('jiti')
    await expect(readFile(join(cwd, 'runs.log'), 'utf-8')).resolves.toBe('.')
  }, 60_000)

  it('should surface a distinct jiti failure rather than the missing global', async () => {
    const cwd = await configFixture('distinct-under-jiti', 'const here = __dirname\nthrow new Error(`threw under jiti from ${typeof here}`)\n')
    const result = await loadConfig(cwd)
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/threw under jiti from string/)
    expect(result.message).not.toMatch(/__dirname/)
  }, 60_000)

  // `compatibilityVersion` is spelled out because the schema resolving it is this repo's, which
  // defaults to the v5 value that a Nuxt 4 project would not see
  it('should not warn a Nuxt 4 project, whose nuxt depends on jiti', async () => {
    const cwd = await configFixture('nuxt-4', `export default { future: { compatibilityVersion: 4 }, runtimeConfig: { value: __dirname ? 'ok' : 'no' } }\n`)
    await installFakeNuxt(cwd, { jiti: '^2.7.0' })
    const result = await loadConfig(cwd)
    expect(result).toMatchObject({ ok: true, value: 'ok' })
    expect(result.logs).not.toContain('NUXT_B5023')
  }, 60_000)

  it('should warn a Nuxt 4 project that opted into compatibilityVersion 5', async () => {
    const cwd = await configFixture('nuxt-4-compat-5', `export default { future: { compatibilityVersion: 5 }, runtimeConfig: { value: __dirname ? 'ok' : 'no' } }\n`)
    await installFakeNuxt(cwd, { jiti: '^2.7.0' })
    const result = await loadConfig(cwd)
    expect(result).toMatchObject({ ok: true, value: 'ok' })
    expect(result.logs).toContain('NUXT_B5023')
  }, 60_000)

  it('should warn a Nuxt 5 project that has not asked for jiti', async () => {
    const cwd = await configFixture('nuxt-5', USES_DIRNAME)
    await installFakeNuxt(cwd, {})
    const result = await loadConfig(cwd)
    expect(result).toMatchObject({ ok: true, value: 'ok' })
    expect(result.logs).toContain('NUXT_B5023')
  }, 60_000)

  it('should not warn a Nuxt 5 project that installed jiti itself', async () => {
    const cwd = await configFixture('nuxt-5-with-jiti', USES_DIRNAME, { devDependencies: { jiti: '^2.7.0' } })
    await installFakeNuxt(cwd, {})
    const result = await loadConfig(cwd)
    expect(result).toMatchObject({ ok: true, value: 'ok' })
    expect(result.logs).not.toContain('NUXT_B5023')
  }, 60_000)

  it('should tell a Nuxt 5 project without jiti how to load a config using CJS globals', async () => {
    const cwd = await configFixture('nuxt-5-no-jiti', USES_DIRNAME)
    await installFakeNuxt(cwd, {})
    const result = await loadConfigWithoutJiti(cwd)
    expect(result.code).toBe('NUXT_B5021')
    expect(result.fix).toMatch(/import\.meta\.dirname/)
    expect(result.fix).toMatch(/jiti/)
  }, 60_000)

  it('should not warn when a config file loads natively', async () => {
    const cwd = await configFixture('native', 'export default { runtimeConfig: { value: \'native\' } }\n')
    const result = await loadConfig(cwd)
    expect(result).toMatchObject({ ok: true, value: 'native' })
    expect(result.logs).not.toContain('NUXT_B5023')
  }, 60_000)

  it('should explain a missing CJS global when jiti cannot be loaded', async () => {
    const result = await loadModuleWithoutJiti('dirname.ts')
    expect(result.ok).toBe(false)
    expect(result.code).toBe('NUXT_B8020')
    expect(result.fix).toMatch(/does not provide the CommonJS globals/)
    expect(result.fix).toMatch(/import\.meta\.dirname/)
    expect(result.fix).toMatch(/jiti/)
  }, 60_000)

  it('should report the module\'s own error rather than retrying it', async () => {
    const result = await loadModule('throws.ts')
    expect(result.ok).toBe(false)
    expect(result.code).toBe('NUXT_B8018')
    expect(result.message).toMatch(/boom/)
  }, 60_000)
})
