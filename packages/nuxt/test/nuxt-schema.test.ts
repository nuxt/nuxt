import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'pathe'
import { exec } from 'tinyexec'
import { afterEach, describe, expect, it } from 'vitest'

const nuxtEntry = pathToFileURL(fileURLToPath(new URL('../src/index.ts', import.meta.url))).href
const kitEntry = pathToFileURL(fileURLToPath(new URL('../../kit/src/index.ts', import.meta.url))).href

// The schema module imports schema files natively, which the test runner's own module loader
// would intercept, so projects are loaded in a plain node process.
const PREPARE = `const { blockJiti, withoutModuleHooks } = JSON.parse(process.argv.at(-1))
const nodeModule = (await import('node:module')).default
const jitiRequests = []
if (blockJiti) {
  nodeModule.registerHooks({
    resolve (specifier, context, next) {
      if (specifier === 'jiti' || /[/\\\\]jiti[/\\\\]/.test(specifier)) {
        jitiRequests.push(specifier)
        throw new Error('jiti is unavailable')
      }
      return next(specifier, context)
    },
  })
}
if (withoutModuleHooks) {
  delete nodeModule.registerHooks
}
const { loadNuxt } = await import(${JSON.stringify(nuxtEntry)})
const { writeTypes } = await import(${JSON.stringify(kitEntry)})
const nuxt = await loadNuxt({ cwd: process.cwd(), overrides: { dev: false, _prepare: true } })
await writeTypes(nuxt)
await nuxt.close()
console.log(JSON.stringify({ jitiRequested: jitiRequests.length > 0 }))`

const dirs: string[] = []
afterEach(async () => {
  await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

async function createProject (files: Record<string, string>) {
  const rootDir = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-schema-')))
  dirs.push(rootDir)
  files = {
    'package.json': JSON.stringify({ private: true, type: 'module', name: 'fixture-nuxt-schema' }),
    'nuxt.config.mjs': 'export default {}',
    ...files,
  }
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(dirname(join(rootDir, path)), { recursive: true })
    await writeFile(join(rootDir, path), contents)
  }
  return rootDir
}

async function prepare (rootDir: string, options: { blockJiti?: boolean, withoutModuleHooks?: boolean } = {}) {
  const { stdout, stderr } = await exec(process.execPath, ['--input-type=module', '-e', PREPARE, '--', JSON.stringify(options)], {
    nodeOptions: { cwd: rootDir },
  })
  const line = stdout.trim().split('\n').at(-1)
  if (!line?.startsWith('{')) {
    throw new Error(`prepare failed:\n${stdout}\n${stderr}`)
  }
  return {
    ...JSON.parse(line) as { jitiRequested: boolean },
    logs: stdout + stderr,
    types: await readFile(join(rootDir, '.nuxt/schema/nuxt.schema.d.ts'), 'utf8'),
    schema: JSON.parse(await readFile(join(rootDir, '.nuxt/schema/nuxt.schema.json'), 'utf8')),
  }
}

const plainSchema = `export default defineNuxtSchema({ appConfig: { plain: { $default: 'value' } } })`
const annotatedSchema = (name: string) => `const value: string = 'value'
export default defineNuxtSchema({
  appConfig: {
    /**
     * An annotated option
     * @type {'value' | 'other'}
     */
    ${name}: value,
  },
})`

describe('nuxt.schema', () => {
  it('imports a schema file without jiti', async () => {
    const rootDir = await createProject({ 'nuxt.schema.ts': plainSchema })
    const result = await prepare(rootDir, { blockJiti: true })

    expect(result.jitiRequested).toBe(false)
    expect(result.schema.properties.appConfig.properties.plain).toMatchObject({ type: 'string', default: 'value' })
  })

  it('reads JSDoc annotations without jiti', async () => {
    const rootDir = await createProject({
      'nuxt.schema.ts': `import options from './schema/options.ts'\n${annotatedSchema('root').replace('appConfig: {', 'appConfig: {\n    options,')}`,
      'schema/options.ts': `export default {\n  /** An imported option */\n  imported: 1,\n}`,
      'layers/annotated/nuxt.config.mjs': 'export default {}',
      'layers/annotated/nuxt.schema.ts': annotatedSchema('layer'),
    })
    const result = await prepare(rootDir, { blockJiti: true })

    expect(result.jitiRequested).toBe(false)
    expect(result.logs).not.toMatch(/NUXT_B50(05|19|36)/)
    const appConfig = result.schema.properties.appConfig.properties
    expect(appConfig.root).toMatchObject({ title: 'An annotated option', tsType: '\'value\' | \'other\'', default: 'value' })
    expect(appConfig.layer).toMatchObject({ title: 'An annotated option', tsType: '\'value\' | \'other\'', default: 'value' })
    expect(appConfig.options.properties.imported).toMatchObject({ title: 'An imported option', default: 1 })
    expect(result.types).toContain(`  /**\n   * An annotated option\n   * \n   * @default "value"\n  */\n  root?: 'value' | 'other',`)
  })

  it('reads JSDoc annotations in a published layer without jiti, but not in its dependencies', async () => {
    const rootDir = await createProject({
      'nuxt.config.mjs': `export default { extends: ['published-layer'] }`,
      'node_modules/published-layer/package.json': JSON.stringify({ name: 'published-layer', type: 'module', main: './nuxt.config.mjs' }),
      'node_modules/published-layer/nuxt.config.mjs': 'export default {}',
      'node_modules/published-layer/nuxt.schema.mjs': `import options from './options.mjs'\nimport { dependency } from 'dependency'\nexport default { appConfig: { options, dependency } }`,
      'node_modules/published-layer/options.mjs': `export default {\n  /** An option */\n  option: 1,\n}`,
      'node_modules/dependency/package.json': JSON.stringify({ name: 'dependency', type: 'module', exports: './index.js' }),
      'node_modules/dependency/index.js': `export const dependency = {\n  /** Not an option */\n  internal: 1,\n}`,
    })
    const result = await prepare(rootDir, { blockJiti: true })

    expect(result.jitiRequested).toBe(false)
    const appConfig = result.schema.properties.appConfig.properties
    expect(appConfig.options.properties.option).toMatchObject({ title: 'An option' })
    expect(appConfig.dependency.properties.internal).not.toHaveProperty('title')
  })

  it.each([true, false])('reports a schema file that throws as a broken schema (jiti blocked: %s)', async (blockJiti) => {
    const rootDir = await createProject({ 'nuxt.schema.ts': `throw new Error('broken schema')` })
    const result = await prepare(rootDir, { blockJiti })

    expect(result.logs.match(/NUXT_B5005/g)).toHaveLength(1)
    expect(result.logs).not.toMatch(/NUXT_B503[67]/)
  })

  it('retries a schema file that throws through jiti when it is installed', async () => {
    const rootDir = await createProject({ 'nuxt.schema.ts': `if (import.meta.url.includes('nuxt-schema=')) { throw new TypeError('native only') }\nexport default { appConfig: { /** Retried */ retried: 1 } }` })
    const result = await prepare(rootDir)

    expect(result.schema.properties.appConfig.properties.retried).toMatchObject({ title: 'Retried' })
    expect(result.logs).toContain('NUXT_B5037')
  })

  describe('a schema file the runtime cannot load', () => {
    const files = {
      'nuxt.config.mjs': `export default { extends: ['published-layer'] }`,
      'node_modules/published-layer/package.json': JSON.stringify({ name: 'published-layer', type: 'module', main: './nuxt.config.mjs' }),
      'node_modules/published-layer/nuxt.config.mjs': 'export default {}',
      'node_modules/published-layer/nuxt.schema.ts': annotatedSchema('published'),
      'nuxt.schema.ts': `import options from './options'\nexport default defineNuxtSchema({ appConfig: { options } })`,
      'options.ts': `export default {\n  /** An extensionless import */\n  extensionless: 1,\n}`,
    }

    it('is loaded through jiti', async () => {
      const rootDir = await createProject(files)
      const result = await prepare(rootDir)

      const appConfig = result.schema.properties.appConfig.properties
      expect(appConfig.published).toMatchObject({ title: 'An annotated option', tsType: '\'value\' | \'other\'' })
      expect(appConfig.options.properties.extensionless).toMatchObject({ title: 'An extensionless import' })
      expect(result.logs).toContain('NUXT_B5037')
      expect(result.logs).toContain('~/node_modules/published-layer/nuxt.schema.ts')
      expect(result.logs).not.toContain('?nuxt-schema=')
    })

    it('is skipped without jiti', async () => {
      const rootDir = await createProject(files)
      const result = await prepare(rootDir, { blockJiti: true })

      expect(result.schema.properties).toBeUndefined()
      expect(result.logs.match(/NUXT_B5036/g)).toHaveLength(2)
      expect(result.logs).toContain('the runtime does not strip types under `node_modules`')
      expect(result.logs).toContain('Relative imports need an explicit file extension')
    })

    it('falls back for a type imported without `import type`', async () => {
      const typeImport = {
        'nuxt.schema.ts': `import { Options } from './types.ts'\nconst options: Options = {\n  /** An option */\n  option: 1,\n}\nexport default defineNuxtSchema({ appConfig: { options } })`,
        'types.ts': 'export interface Options { option: number }',
      }
      const withJiti = await prepare(await createProject(typeImport))
      expect(withJiti.schema.properties.appConfig.properties.options.properties.option).toMatchObject({ title: 'An option' })
      expect(withJiti.logs).toContain('NUXT_B5037')

      const withoutJiti = await prepare(await createProject(typeImport), { blockJiti: true })
      expect(withoutJiti.logs).toContain('NUXT_B5036')
      expect(withoutJiti.logs).toContain('imported with `import type`')
    })
  })

  describe('on a runtime without synchronous module hooks', () => {
    it('loads schema files through jiti', async () => {
      const rootDir = await createProject({ 'nuxt.schema.ts': annotatedSchema('root') })
      const result = await prepare(rootDir, { withoutModuleHooks: true })

      expect(result.schema.properties.appConfig.properties.root).toMatchObject({ title: 'An annotated option' })
      expect(result.logs).not.toContain('NUXT_B5037')
    })

    it('skips schema files without jiti', async () => {
      const rootDir = await createProject({ 'nuxt.schema.ts': annotatedSchema('root') })
      const result = await prepare(rootDir, { blockJiti: true, withoutModuleHooks: true })

      expect(result.schema.properties).toBeUndefined()
      expect(result.logs).toContain('NUXT_B5019')
    })
  })
})
