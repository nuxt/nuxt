import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { exec } from 'tinyexec'
import { resolveModulePath } from 'exsolve'
import { join } from 'pathe'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const kitEntry = join(repoRoot, 'packages/kit/src/index.ts')

// The installed `jiti`, symlinked into the fixtures below to stand in for a project-level copy.
const installedJiti = join(resolveModulePath('jiti', { from: import.meta.url }), '../..')

/**
 * Hook that makes the bare specifier `jiti` unresolvable while still allowing it to be loaded by
 * absolute path, standing in for a layout where `jiti` is present in the project but not linked
 * as a peer dependency of `@nuxt/kit`.
 */
const BLOCK_BARE = `export function resolve (specifier, context, next) {
  if (specifier === 'jiti') { throw new Error('bare jiti blocked') }
  return next(specifier, context)
}`

/** Hook that makes `jiti` unreachable entirely, shared with the `no-jiti` test project. */
const BLOCK_ALL = pathToFileURL(join(repoRoot, 'test/no-jiti/block-jiti-loader.mjs')).href

const RUNNER = `import { register } from 'node:module'
register(new URL(process.argv[2], import.meta.url))
const kit = await import(process.argv[3])
const cwd = process.argv[4]
const nuxt = { options: { rootDir: cwd, alias: {}, modulesDir: [cwd + '/node_modules'] } }
try {
  const options = await kit.loadNuxtConfig({ cwd })
  const { nuxtModule } = await kit.loadNuxtModuleInstance('enum-module', nuxt)
  console.log(JSON.stringify({ ok: true, marker: options.$marker, module: typeof nuxtModule }))
} catch (error) {
  console.log(JSON.stringify({ ok: false, code: error.code, message: error.message }))
}`

// `enum` is the cheapest syntax the runtime refuses to strip, so both the config and the module
// in the fixture can only be loaded through jiti.
describe('jiti resolution', { sequential: true }, () => {
  // Created outside the repository on purpose: resolution walks up through `node_modules`, so a
  // fixture inside the workspace would find the repo's own `nuxt` and `jiti` and prove nothing.
  let tempDir: string
  let projectDir: string
  let projectJiti: string

  async function run (hook: string) {
    const { stdout } = await exec(process.execPath, [join(tempDir, 'run.mjs'), hook, kitEntry, projectDir], {
      nodeOptions: { cwd: repoRoot },
    })
    const line = stdout.trim().split('\n').at(-1)!
    return JSON.parse(line) as { ok: boolean, marker?: unknown, module?: string, code?: string, message?: string }
  }

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'nuxt-jiti-'))
    projectDir = join(tempDir, 'project')
    projectJiti = join(projectDir, 'node_modules/jiti')

    await writeFile(join(tempDir, 'block-bare.mjs'), BLOCK_BARE)
    await writeFile(join(tempDir, 'run.mjs'), RUNNER)

    await mkdir(join(projectDir, 'node_modules/enum-module'), { recursive: true })
    await writeFile(join(projectDir, 'package.json'), JSON.stringify({ name: 'jiti-fixture', private: true, type: 'module' }))
    await writeFile(join(projectDir, 'nuxt.config.ts'), 'enum Marker { value }\nexport default { $marker: Marker.value }\n')

    const moduleDir = join(projectDir, 'node_modules/enum-module')
    await writeFile(join(moduleDir, 'package.json'), JSON.stringify({ name: 'enum-module', version: '1.0.0', type: 'module', exports: './index.ts' }))
    await writeFile(join(moduleDir, 'index.ts'), 'enum Kind { a }\nexport default () => { void Kind.a }\n')
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('falls back to a project-level jiti when it is not resolvable from @nuxt/kit', async () => {
    await symlink(installedJiti, projectJiti, 'dir')

    const result = await run('block-bare.mjs')
    expect(result).toMatchObject({ ok: true, marker: 0, module: 'function' })

    await rm(projectJiti, { recursive: true, force: true })
  }, 60_000)

  // A project depends on `nuxt`, not on what `nuxt` depends on, so under an isolated
  // `node_modules` the `jiti` that Nuxt 3 and 4 install is only reachable by hopping through the
  // `nuxt` package itself. This fixture reproduces that layout.
  it('falls back to the jiti that nuxt depends on', async () => {
    const store = join(projectDir, 'node_modules/.store/nuxt/node_modules')
    await mkdir(join(store, 'nuxt'), { recursive: true })
    await writeFile(join(store, 'nuxt/package.json'), JSON.stringify({ name: 'nuxt', version: '4.5.1', type: 'module', main: 'index.mjs' }))
    await writeFile(join(store, 'nuxt/index.mjs'), 'export default {}\n')
    await symlink(installedJiti, join(store, 'jiti'), 'dir')
    await symlink(join(store, 'nuxt'), join(projectDir, 'node_modules/nuxt'), 'dir')

    const result = await run('block-bare.mjs')
    expect(result).toMatchObject({ ok: true, marker: 0, module: 'function' })

    await rm(join(projectDir, 'node_modules/nuxt'), { recursive: true, force: true })
    await rm(join(projectDir, 'node_modules/.store'), { recursive: true, force: true })
  }, 60_000)

  // Proves the two tests above exercise the fallbacks rather than passing because jiti happens to
  // be resolvable some other way.
  it('has nothing to fall back to once neither is present', async () => {
    const result = await run('block-bare.mjs')
    expect(result.ok).toBe(false)
    expect(result.code).toBe('NUXT_B5017')
  }, 60_000)

  it('reports how to install jiti when it cannot be found anywhere', async () => {
    const result = await run(BLOCK_ALL)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('NUXT_B5017')
    expect(result.message).toMatch(/could not be loaded/)
  }, 60_000)
})
