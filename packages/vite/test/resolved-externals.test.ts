import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { ResolveExternalsPlugin } from '../src/plugins/resolved-externals.ts'

const root = join(tmpdir(), 'nuxt-resolved-externals-test')

function createNuxt (options: Record<string, unknown> = {}) {
  return {
    'options': {
      dev: false,
      rootDir: '/project',
      buildDir: '/project/.nuxt',
      extensions: ['.js', '.ts', '.mjs'],
      ...options,
    },
    '~runtimeDependencies': [],
  } as any
}

function createEnvironment (name = 'ssr', resolve: Record<string, unknown> = {}) {
  return { name, config: { resolve: { conditions: ['module', 'node', 'development|production'], ...resolve } } } as any
}

function environmentPlugin (nuxt = createNuxt(), environment = createEnvironment()) {
  const plugin = ResolveExternalsPlugin(nuxt) as any
  return plugin.applyToEnvironment(environment)
}

function resolveId (plugin: any, context: any, id: string, importer?: string) {
  return plugin.resolveId.handler.call(context, id, importer)
}

function writePackage (dir: string, value: string) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'dep', type: 'module', exports: './index.js' }))
  writeFileSync(join(dir, 'index.js'), `export default ${JSON.stringify(value)}`)
}

describe('ResolveExternalsPlugin', () => {
  const rootDep = join(root, 'node_modules/dep')
  const nestedDep = join(root, 'node_modules/mod/node_modules/dep')
  const importer = join(root, 'node_modules/mod/dist/deep/plugin.js')
  const layerImporter = join(root, 'layer/plugins/plugin.js')

  beforeAll(() => {
    writePackage(rootDep, 'root')
    writePackage(nestedDep, 'nested')
    mkdirSync(join(root, 'node_modules/mod/dist/deep'), { recursive: true })
    mkdirSync(join(root, 'layer/plugins'), { recursive: true })
    writeFileSync(importer, 'import dep from "dep"')
    writeFileSync(layerImporter, 'import dep from "dep"')
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('does not apply in dev, outside the ssr environment, or to a build that inlines everything', () => {
    expect(environmentPlugin(createNuxt({ dev: true }))).toBe(false)
    expect(environmentPlugin(createNuxt(), createEnvironment('client'))).toBe(false)
    expect(environmentPlugin(createNuxt(), createEnvironment('ssr', { noExternal: true }))).toBe(false)
    expect(environmentPlugin(createNuxt(), createEnvironment('ssr', { noExternal: [/foo/] }))).not.toBe(false)
  })

  // https://github.com/nuxt/nuxt/issues/22077
  it('resolves bare externals from the importing package', async () => {
    const plugin = environmentPlugin()
    const context = { resolve: vi.fn().mockResolvedValue({ id: 'dep', external: true }) }

    await expect(resolveId(plugin, context, 'dep', importer)).resolves.toStrictEqual({ id: join(nestedDep, 'index.js'), external: 'absolute' })
    expect(context.resolve).toHaveBeenCalledWith('dep', importer, { skipSelf: true })

    await expect(resolveId(plugin, context, 'dep', layerImporter)).resolves.toStrictEqual({ id: join(rootDep, 'index.js'), external: 'absolute' })
  })

  it('does not resolve for importers inside the project', async () => {
    const context = { resolve: vi.fn() }

    await expect(resolveId(environmentPlugin(), context, 'dep', '/project/app/plugins/plugin.js')).resolves.toBeUndefined()
    expect(context.resolve).not.toHaveBeenCalled()

    for (const importer of ['/project/node_modules/mod/plugin.js', '/other/layer/plugins/plugin.js']) {
      await resolveId(environmentPlugin(), context, 'dep', importer)
      expect(context.resolve).toHaveBeenCalledWith('dep', importer, { skipSelf: true })
    }

    await resolveId(environmentPlugin(createNuxt({ buildDir: '/elsewhere/.nuxt' })), context, 'dep', '/project/app/plugins/plugin.js')
    expect(context.resolve).toHaveBeenCalledWith('dep', '/project/app/plugins/plugin.js', { skipSelf: true })
  })

  it('leaves inlined and unresolvable modules alone', async () => {
    const plugin = environmentPlugin()

    const inlined = { id: join(nestedDep, 'index.js'), external: false }
    await expect(resolveId(plugin, { resolve: vi.fn().mockResolvedValue(inlined) }, 'dep', importer)).resolves.toBe(inlined)

    const unresolvable = { id: 'does-not-exist', external: true }
    await expect(resolveId(plugin, { resolve: vi.fn().mockResolvedValue(unresolvable) }, 'does-not-exist', importer)).resolves.toBe(unresolvable)
  })

  it('skips node builtins and ids without an importer', async () => {
    const plugin = environmentPlugin()
    const context = { resolve: vi.fn() }

    await expect(resolveId(plugin, context, 'node:fs', importer)).resolves.toBeUndefined()
    await expect(resolveId(plugin, context, 'fs', importer)).resolves.toBeUndefined()
    await expect(resolveId(plugin, context, 'dep')).resolves.toBeUndefined()
    expect(context.resolve).not.toHaveBeenCalled()
  })

  it.each([
    ['./relative.js', false],
    ['/abs/path.js', false],
    ['C:\\abs\\path.js', false],
    ['\0virtual:nuxt', false],
    ['virtual:nuxt', false],
    ['#app', false],
    ['~/foo', false],
    ['dep', true],
    ['@scope/dep/deep', true],
  ])('filters %s', (id, matches) => {
    const plugin = environmentPlugin()
    expect(plugin.resolveId.filter.id.test(id)).toBe(matches)
  })
})
