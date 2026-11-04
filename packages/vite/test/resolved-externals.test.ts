import { mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { ResolveExternalsPlugin } from '../src/plugins/resolved-externals.ts'

const root = join(realpathSync(tmpdir()), 'nuxt-resolved-externals-test')

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
  const subpathDep = join(root, 'node_modules/subpath-dep')
  const importer = join(root, 'node_modules/mod/dist/deep/plugin.js')
  const layerImporter = join(root, 'layer/plugins/plugin.js')

  beforeAll(() => {
    writePackage(rootDep, 'root')
    writePackage(nestedDep, 'nested')
    mkdirSync(join(root, 'node_modules/mod/dist/deep'), { recursive: true })
    mkdirSync(join(root, 'layer/plugins'), { recursive: true })
    writeFileSync(importer, 'import dep from "dep"')
    writeFileSync(layerImporter, 'import dep from "dep"')
    mkdirSync(join(subpathDep, 'dist'), { recursive: true })
    writeFileSync(join(subpathDep, 'package.json'), JSON.stringify({ name: 'subpath-dep', type: 'module', exports: { '.': './dist/index.js', './sub': { import: './dist/sub.js' } } }))
    for (const file of ['index.js', 'sub.js', 'internal.js']) {
      writeFileSync(join(subpathDep, 'dist', file), 'export default 1')
    }
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

  it('does not resolve a deduped package from the importing package', async () => {
    const plugin = environmentPlugin(createNuxt(), createEnvironment('ssr', { dedupe: ['dep', '@scope/dep'] }))
    const context = { resolve: vi.fn().mockResolvedValue({ id: 'dep', external: true }) }

    for (const id of ['dep', 'dep/sub', '@scope/dep/sub', join(rootDep, 'index.js')]) {
      await expect(resolveId(plugin, context, id, importer)).resolves.toBeUndefined()
    }
    expect(context.resolve).not.toHaveBeenCalled()
  })

  it('resolves an absolute import of a package entry like the bare import', async () => {
    const plugin = environmentPlugin()
    const context = { resolve: vi.fn().mockResolvedValue({ id: 'dep', external: true }) }
    const template = '\0nuxt-nitro-virtual:#internal/nuxt/paths'
    const entry = join(rootDep, 'index.js')
    const nestedEntry = join(nestedDep, 'index.js')

    await expect(resolveId(plugin, context, entry, template)).resolves.toStrictEqual({ id: entry, external: 'absolute' })
    await expect(resolveId(plugin, context, entry.replace(/\//g, '\\'), template)).resolves.toStrictEqual({ id: entry, external: 'absolute' })
    await expect(resolveId(plugin, context, nestedEntry, '/project/app/plugins/plugin.js')).resolves.toStrictEqual({ id: nestedEntry, external: 'absolute' })
    expect(context.resolve).toHaveBeenLastCalledWith('dep', nestedEntry, { skipSelf: true })

    await expect(resolveId(plugin, context, join(rootDep, 'package.json'), template)).resolves.toBeUndefined()
    await expect(resolveId(plugin, { resolve: vi.fn().mockResolvedValue({ id: entry, external: false }) }, entry, template)).resolves.toBeUndefined()
    await expect(resolveId(plugin, { resolve: vi.fn().mockRejectedValue(new Error('No known conditions for "." specifier in "dep" package')) }, entry, template)).resolves.toBeUndefined()
  })

  it('resolves an absolute import of an exported package subpath like the bare import', async () => {
    const plugin = environmentPlugin()
    const context = { resolve: vi.fn().mockResolvedValue({ id: 'subpath-dep/sub', external: true }) }
    const template = '\0nuxt-nitro-virtual:#internal/nuxt/paths'
    const sub = join(subpathDep, 'dist/sub.js')

    await expect(resolveId(plugin, context, sub, template)).resolves.toStrictEqual({ id: sub, external: 'absolute' })
    expect(context.resolve).toHaveBeenLastCalledWith('subpath-dep/sub', sub, { skipSelf: true })

    context.resolve.mockClear()
    await expect(resolveId(plugin, context, join(subpathDep, 'dist/internal.js'), template)).resolves.toBeUndefined()
    expect(context.resolve).not.toHaveBeenCalled()
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
    ['/abs/node_modules/dep/index.js', true],
    ['/abs/node_modules/dep/index.cjs', true],
    ['C:\\abs\\node_modules\\dep\\index.mjs', true],
    ['/abs/node_modules/dep/index.mjs?macro=true', false],
    ['/abs/node_modules/dep/style.css', false],
    ['/abs/node_modules/dep/component.vue', false],
    ['\0/abs/node_modules/dep/index.js', false],
    ['virtual:/abs/node_modules/dep/index.js', false],
    ['/project/node_modules/nuxt/dist/app/entry.js', false],
    ['/project/node_modules/nuxt/node_modules/ufo/dist/index.mjs', true],
    ['C:\\abs\\path.js', false],
    ['\0virtual:nuxt', false],
    ['virtual:nuxt', false],
    ['#app', false],
    ['~/foo', false],
    ['dep', true],
    ['@scope/dep/deep', true],
  ])('filters %s', (id, matches) => {
    const { include, exclude } = environmentPlugin(createNuxt({ appDir: '/project/node_modules/nuxt/dist/app' })).resolveId.filter.id
    expect(include.some((re: RegExp) => re.test(id)) && !exclude.some((re: RegExp) => re.test(id))).toBe(matches)
  })
})
