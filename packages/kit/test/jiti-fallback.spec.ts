import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
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
const { isLoaderError } = await import(entry)
try {
  await import(target)
  console.log(JSON.stringify({ imported: true }))
} catch (error) {
  console.log(JSON.stringify({ code: error.code, isLoaderError: isLoaderError(error) }))
}`

const LOAD_MODULE = `const [entry, cwd, id] = process.argv.slice(-3)
const kit = await import(entry)
const nuxt = { options: { rootDir: cwd, alias: {}, modulesDir: [cwd + '/node_modules'] } }
try {
  const { nuxtModule } = await kit.loadNuxtModuleInstance(id, nuxt)
  console.log(JSON.stringify({ ok: true, module: typeof nuxtModule }))
} catch (error) {
  console.log(JSON.stringify({ ok: false, code: error.code, message: error.message }))
}`

function output (stdout: string, stderr: string) {
  const line = stdout.trim().split('\n').at(-1)
  if (!line) {
    throw new Error(`no output: ${stderr}`)
  }
  return JSON.parse(line)
}

describe('jiti fallback', { sequential: true }, () => {
  let dir: string

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'kit-loader-error-'))
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'loader-error-fixture', private: true, type: 'module' }))
    await writeFile(join(dir, 'nested.ts'), 'export const nested = 1\n')
    await writeFile(join(dir, 'extensionless-import.ts'), 'import { nested } from \'./nested\'\nexport default () => nested\n')
    await writeFile(join(dir, 'json-import.ts'), 'import pkg from \'./package.json\'\nexport default () => pkg\n')
    await writeFile(join(dir, 'throws.ts'), 'throw new Error(\'boom\')\n')

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

  async function loadModule (file: string) {
    const { stdout, stderr } = await exec(process.execPath, ['--input-type=module', '-e', LOAD_MODULE, '--', kitEntry, dir, join(dir, file)], {
      nodeOptions: { cwd: dir },
    })
    return output(stdout, stderr) as { ok: boolean, module?: string, code?: string, message?: string }
  }

  it('should classify an extensionless import within a natively loadable entry as a loader error', async () => {
    await expect(classify('extensionless-import.ts')).resolves.toStrictEqual({
      code: 'ERR_MODULE_NOT_FOUND',
      isLoaderError: true,
    })
  })

  it('should classify a JSON import without an import attribute as a loader error', async () => {
    await expect(classify('json-import.ts')).resolves.toStrictEqual({
      code: 'ERR_IMPORT_ATTRIBUTE_MISSING',
      isLoaderError: true,
    })
  })

  it('should not classify an error the file itself threw as a loader error', async () => {
    await expect(classify('throws.ts')).resolves.toStrictEqual({ isLoaderError: false })
  })

  it('should load a module whose nested import the runtime cannot resolve', async () => {
    await expect(loadModule('extensionless-import.ts')).resolves.toMatchObject({ ok: true, module: 'function' })
  }, 60_000)

  it('should load a module importing JSON without an import attribute', async () => {
    await expect(loadModule('json-import.ts')).resolves.toMatchObject({ ok: true, module: 'function' })
  }, 60_000)

  it('should report the module\'s own error rather than retrying it', async () => {
    const result = await loadModule('throws.ts')
    expect(result.ok).toBe(false)
    expect(result.code).toBe('NUXT_B8018')
    expect(result.message).toMatch(/boom/)
  }, 60_000)
})
