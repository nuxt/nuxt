import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { afterAll, describe, expect, it } from 'vitest'
import { join } from 'pathe'
import { type Plugin, createServer } from 'vite'
import type { Nuxt } from '@nuxt/schema'

import { createOptimizeDepsIncludeResolver, installedScanEntries } from '../src/utils/optimize-deps.ts'
import { OptimizeDepsPlugin } from '../src/plugins/optimize-deps.ts'
import { userOptimizeDepsInclude } from '../src/plugins/optimize-deps-hint.ts'

const rootDir = await mkdtemp(join(tmpdir(), 'nuxt-optimize-deps-'))
const srcDir = join(rootDir, 'app/')
const layerRoot = join(rootDir, 'node_modules/installed-layer/')
const layerSrcDir = join(layerRoot, 'app/')
const subpathLayerPackageRoot = join(rootDir, 'node_modules/subpath-layer/')
const subpathLayerRoot = join(subpathLayerPackageRoot, 'layers/child/')
const aliasedLayerRoot = join(rootDir, 'node_modules/aliased-layer/')
const parentLayerRoot = join(rootDir, 'node_modules/parent-layer/')
const nestedLayerRoot = join(parentLayerRoot, 'node_modules/nested-layer/')
const otherParentLayerRoot = join(rootDir, 'node_modules/other-parent-layer/')
const otherNestedLayerRoot = join(otherParentLayerRoot, 'node_modules/nested-layer/')
const linkedDependencyRoot = join(rootDir, 'linked-dependency/')
const reachableCycleLayerRoot = join(rootDir, 'node_modules/reachable-cycle-layer/')
const cycleLayerARoot = join(rootDir, 'isolated/node_modules/cycle-layer-a/')
const cycleLayerBRoot = join(rootDir, 'isolated/node_modules/cycle-layer-b/')
const parenLayerRoot = join(rootDir, 'node_modules/.pnpm/paren-layer@1.0.0(vue@3.5.0)/node_modules/paren-layer/')
const parenLayerSrcDir = join(parenLayerRoot, 'app/')
const moduleRuntime = join(rootDir, 'node_modules/installed-module/runtime/')
const entry = join(srcDir, 'entry.mjs')
const layerComponent = join(layerSrcDir, 'components/LayerComponent.vue')
const unusedLayerComponent = join(layerSrcDir, 'components/UnusedLayerComponent.vue')
const modeServerComponent = join(layerSrcDir, 'components/ModeServer.vue')
const modeServerPlugin = join(layerSrcDir, 'plugins/mode-server.mjs')
const modeServerPage = join(layerSrcDir, 'pages/mode-server.vue')

const registered = {
  plugins: [{ src: join(moduleRuntime, 'plugin.mjs') }],
  components: [{ filePath: join(moduleRuntime, 'Component.vue') }],
  middleware: [{ path: join(moduleRuntime, 'middleware.mjs') }],
  layouts: { installed: { file: join(moduleRuntime, 'layout.vue') } },
}

async function writePackage (dir: string, name: string, contents: string, main = 'index.mjs') {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', type: main.endsWith('.mjs') ? 'module' : 'commonjs', main }))
  await writeFile(join(dir, main), contents)
}

await mkdir(join(layerSrcDir, 'plugins'), { recursive: true })
await mkdir(join(layerSrcDir, 'components'), { recursive: true })
await mkdir(join(layerSrcDir, 'pages'), { recursive: true })
await mkdir(srcDir, { recursive: true })
await writeFile(join(rootDir, 'package.json'), JSON.stringify({ name: 'fixture', type: 'module' }))
await writeFile(entry, 'export default 1\n')
await writeFile(join(layerRoot, 'package.json'), JSON.stringify({ name: 'installed-layer', type: 'module' }))
await writeFile(join(layerSrcDir, 'plugins/broken.mjs'), 'import { hello } from \'layer-dep\'\nexport default hello\n')
await writeFile(layerComponent, '<script setup>\nimport x from \'layer-component-dep\'\n</script>\n')
await writeFile(unusedLayerComponent, '<script setup>\nimport x from \'unused-layer-component-dep\'\n</script>\n')
await writeFile(modeServerComponent, '<script setup>\nimport x from \'server-component-dep\'\n</script>\n')
await writeFile(modeServerPlugin, 'import x from \'server-plugin-dep\'\nexport default x\n')
await writeFile(modeServerPage, '<script setup>\nimport x from \'server-page-dep\'\n</script>\n')
await writePackage(join(layerRoot, 'node_modules/layer-dep'), 'layer-dep', 'import cjs from \'cjs-only\'\nexport const hello = () => cjs()\n')
await writePackage(join(layerRoot, 'node_modules/cjs-only'), 'cjs-only', 'module.exports = () => \'hi\'\n', 'index.js')
await mkdir(join(layerRoot, 'node_modules/manifestless-dep'), { recursive: true })
await writeFile(join(layerRoot, 'node_modules/manifestless-dep/index.js'), 'module.exports = 1\n')
await writePackage(join(layerRoot, 'node_modules/hoisted-dep'), 'hoisted-dep', 'export default 1\n')
await writePackage(join(layerSrcDir, 'node_modules/nested-pkg'), 'nested-pkg', 'import x from \'hoisted-dep\'\nexport default x\n')
await writePackage(subpathLayerPackageRoot, 'subpath-layer', 'export default 1\n')
await writePackage(join(subpathLayerPackageRoot, 'node_modules/subpath-dep'), 'subpath-dep', 'export default 1\n')
await writePackage(aliasedLayerRoot, 'real-layer-name', 'export default 1\n')
await writePackage(join(aliasedLayerRoot, 'node_modules/aliased-dep'), 'aliased-dep', 'export default 1\n')
await writePackage(join(rootDir, 'node_modules/root-dep'), 'root-dep', 'export default 1\n')
await writePackage(parentLayerRoot, 'parent-layer', 'export default 1\n')
await writePackage(nestedLayerRoot, 'nested-layer', 'export default 1\n')
await writePackage(join(nestedLayerRoot, 'node_modules/nested-dep'), 'nested-dep', 'export default 1\n')
await writePackage(join(nestedLayerRoot, 'node_modules/root-dep'), 'root-dep', 'export default 2\n')
await writePackage(otherParentLayerRoot, 'other-parent-layer', 'export default 1\n')
await writePackage(otherNestedLayerRoot, 'nested-layer', 'export default 2\n')
await writePackage(join(otherNestedLayerRoot, 'node_modules/nested-dep'), 'nested-dep', 'export default 2\n')
await writePackage(linkedDependencyRoot, 'linked-dep', 'export default 1\n')
await symlink(linkedDependencyRoot, join(rootDir, 'node_modules/linked-dep'), 'dir')
await symlink(linkedDependencyRoot, join(nestedLayerRoot, 'node_modules/linked-dep'), 'dir')
await mkdir(join(parenLayerSrcDir, 'plugins'), { recursive: true })
await writeFile(join(parenLayerSrcDir, 'plugins/paren.mjs'), 'import x from \'paren-layer-dep\'\nexport default x\n')
await writePackage(reachableCycleLayerRoot, 'reachable-cycle-layer', 'export default 1\n')
await writePackage(cycleLayerARoot, 'cycle-layer-a', 'export default 1\n')
await writePackage(cycleLayerBRoot, 'cycle-layer-b', 'export default 1\n')
await writePackage(join(cycleLayerARoot, 'node_modules/cycle-dep-a'), 'cycle-dep-a', 'export default 1\n')
await writePackage(join(cycleLayerBRoot, 'node_modules/cycle-dep-b'), 'cycle-dep-b', 'export default 1\n')
await mkdir(join(reachableCycleLayerRoot, 'node_modules'), { recursive: true })
await symlink(cycleLayerBRoot, join(reachableCycleLayerRoot, 'node_modules/cycle-layer-b'), 'dir')
await symlink(cycleLayerARoot, join(cycleLayerBRoot, 'node_modules/cycle-layer-a'), 'dir')
await symlink(cycleLayerBRoot, join(cycleLayerARoot, 'node_modules/cycle-layer-b'), 'dir')

await mkdir(moduleRuntime, { recursive: true })
await writeFile(join(moduleRuntime, 'plugin.mjs'), 'import x from \'plugin-dep\'\nexport default x\n')
await writeFile(join(moduleRuntime, 'Component.vue'), '<script setup>\nimport x from \'component-dep\'\n</script>\n')
await writeFile(join(moduleRuntime, 'middleware.mjs'), 'import x from \'middleware-dep\'\nexport default x\n')
await writeFile(join(moduleRuntime, 'layout.vue'), '<script setup>\nimport x from \'layout-dep\'\n</script>\n')
for (const dep of ['plugin-dep', 'component-dep', 'layer-component-dep', 'unused-layer-component-dep', 'server-component-dep', 'server-plugin-dep', 'server-page-dep', 'middleware-dep', 'layout-dep', 'paren-layer-dep']) {
  await writePackage(join(rootDir, 'node_modules', dep), dep, 'export default 1\n')
}

afterAll(() => rm(rootDir, { recursive: true, force: true }))

function createNuxt (layerDirs: Array<{ app: string, root: string }> = [], apps: Record<string, any> = { default: { components: [], plugins: [], middleware: [], layouts: {} } }, root = rootDir, src = srcDir) {
  return {
    apps,
    options: {
      rootDir: root,
      srcDir: src,
      alias: {},
      vite: {},
      _layers: [
        { cwd: root, config: { rootDir: root, srcDir: src } },
        ...layerDirs.map(dirs => ({ cwd: dirs.root, config: { rootDir: dirs.root, srcDir: dirs.app } })),
      ],
    },
  } as unknown as Nuxt
}

const installedLayer = { app: layerSrcDir, root: layerRoot }
const subpathLayer = { app: join(subpathLayerRoot, 'app/'), root: subpathLayerRoot }
const aliasedLayer = { app: join(aliasedLayerRoot, 'app/'), root: aliasedLayerRoot }
const parentLayer = { app: join(parentLayerRoot, 'app/'), root: parentLayerRoot }
const nestedLayer = { app: join(nestedLayerRoot, 'app/'), root: nestedLayerRoot }
const otherParentLayer = { app: join(otherParentLayerRoot, 'app/'), root: otherParentLayerRoot }
const otherNestedLayer = { app: join(otherNestedLayerRoot, 'app/'), root: otherNestedLayerRoot }
const parenLayer = { app: parenLayerSrcDir, root: parenLayerRoot }
const reachableCycleLayer = { app: join(reachableCycleLayerRoot, 'app/'), root: reachableCycleLayerRoot }
const cycleLayerA = { app: join(cycleLayerARoot, 'app/'), root: cycleLayerARoot }
const cycleLayerB = { app: join(cycleLayerBRoot, 'app/'), root: cycleLayerBRoot }

function resolveOptimizeDepsInclude (nuxt: Nuxt, include: string[], options: { preserveSymlinks?: boolean } = {}) {
  return createOptimizeDepsIncludeResolver(nuxt, options)(include)
}

async function optimizedDeps (options: { entries?: string[], include?: string[], plugins?: Plugin[], preserveSymlinks?: boolean }) {
  const server = await createServer({
    root: rootDir,
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
    plugins: options.plugins,
    resolve: { preserveSymlinks: options.preserveSymlinks },
    environments: {
      client: {
        optimizeDeps: {
          entries: options.entries ?? [entry],
          include: options.include ?? [],
        },
      },
    },
  })
  const optimizer = server.environments.client.depsOptimizer
  await optimizer?.scanProcessing
  const deps = Object.keys({ ...optimizer?.metadata.optimized, ...optimizer?.metadata.discovered })
  await server.close()
  return deps
}

describe('installedScanEntries', () => {
  it('should not scan layers that are part of the project', () => {
    const nuxt = createNuxt([{ app: join(rootDir, 'layers/local/app/'), root: join(rootDir, 'layers/local/') }])

    expect(installedScanEntries(nuxt)).toEqual([])
  })

  it('should pre-bundle dependencies only reachable through an installed layer', async () => {
    await expect(optimizedDeps({})).resolves.toEqual([])

    const entries = [entry, ...installedScanEntries(createNuxt([installedLayer]))]

    await expect(optimizedDeps({ entries })).resolves.toContain('layer-dep')
  })

  it('should scan eager app files that modules register from within node_modules', async () => {
    const nuxt = createNuxt([], { default: registered })

    const entries = installedScanEntries(nuxt)

    expect(entries.toSorted()).toEqual([
      registered.components[0]!.filePath,
      registered.layouts.installed.file,
      registered.middleware[0]!.path,
      registered.plugins[0]!.src,
    ].toSorted())
    await expect(optimizedDeps({ entries: [entry, ...entries] })).resolves.toEqual(
      expect.arrayContaining(['plugin-dep', 'component-dep', 'middleware-dep', 'layout-dep']),
    )
  })

  it('should not scan client-inaccessible app files', () => {
    const serverFile = join(moduleRuntime, 'plugin.server.mjs')
    const nuxt = createNuxt([installedLayer], {
      default: {
        components: [{ filePath: join(moduleRuntime, 'Component.server.vue'), mode: 'server' }],
        plugins: [{ src: serverFile, mode: 'server' }],
        middleware: [{ path: join(moduleRuntime, 'middleware.server.mjs') }],
        layouts: { installed: { file: join(moduleRuntime, 'layout.server.vue') } },
      },
    })

    expect(installedScanEntries(nuxt)).toEqual([
      join(layerSrcDir, '**/*.{vue,js,jsx,mjs,ts,tsx,mts}'),
      '!' + join(layerSrcDir, '**/node_modules/**'),
      '!' + join(layerSrcDir, '**/*.server.{vue,js,jsx,mjs,ts,tsx,mts}'),
    ])
  })

  it('should not scan server-mode files from installed layers', async () => {
    const nuxt = createNuxt([installedLayer], {
      default: {
        components: [{ filePath: modeServerComponent, mode: 'server' }],
        plugins: [{ src: modeServerPlugin, mode: 'server' }],
        middleware: [],
        layouts: {},
        pages: [{ path: '/parent', children: [{ path: 'server', file: modeServerPage, mode: 'server' }] }],
      },
    })

    const entries = installedScanEntries(nuxt)

    const deps = await optimizedDeps({ entries: [entry, ...entries] })
    expect(deps).not.toContain('server-component-dep')
    expect(deps).not.toContain('server-plugin-dep')
    expect(deps).not.toContain('server-page-dep')
  })

  it('should not scan app files that are part of the project', () => {
    const nuxt = createNuxt([], {
      default: {
        components: [{ filePath: join(srcDir, 'components/Local.vue') }],
        plugins: [{ src: join(srcDir, 'plugins/local.mjs') }],
        middleware: [{ path: join(srcDir, 'middleware/local.mjs') }],
        layouts: { local: { file: join(srcDir, 'layouts/local.vue') } },
      },
    })

    expect(installedScanEntries(nuxt)).toEqual([])
  })

  it('should normalize installed module paths on Windows', () => {
    const nuxt = createNuxt([], {
      default: {
        components: [],
        plugins: [{ src: 'C:\\project\\node_modules\\installed-module\\runtime\\plugin.mjs' }],
        middleware: [],
        layouts: {},
      },
    })

    expect(installedScanEntries(nuxt)).toEqual(['C:/project/node_modules/installed-module/runtime/plugin.mjs'])
  })

  it('should normalize installed layer paths on Windows', () => {
    const projectRoot = 'C:\\project\\'
    const installedRoot = 'C:\\project\\node_modules\\installed-layer\\'
    const nuxt = createNuxt([{ app: installedRoot + 'app\\', root: installedRoot }], undefined, projectRoot, projectRoot + 'app\\')

    expect(installedScanEntries(nuxt)).toEqual([
      'C:/project/node_modules/installed-layer/app/**/*.{vue,js,jsx,mjs,ts,tsx,mts}',
      '!C:/project/node_modules/installed-layer/app/**/node_modules/**',
      '!C:/project/node_modules/installed-layer/app/**/*.server.{vue,js,jsx,mjs,ts,tsx,mts}',
    ])
  })

  it('should scan installed layers whose path contains glob characters', async () => {
    const entries = installedScanEntries(createNuxt([parenLayer]))

    await expect(optimizedDeps({ entries: [entry, ...entries] })).resolves.toContain('paren-layer-dep')
  })

  it('should not scan dependencies nested within the layer', async () => {
    const entries = installedScanEntries(createNuxt([installedLayer]))

    await expect(optimizedDeps({ entries: [entry, ...entries.filter(e => !e.startsWith('!'))] })).resolves.toContain('hoisted-dep')
    await expect(optimizedDeps({ entries: [entry, ...entries] })).resolves.not.toContain('hoisted-dep')
  })
})

describe('OptimizeDepsPlugin', () => {
  async function configureEnvironment (nuxt: Nuxt, name: string, config: Record<string, any>) {
    const plugin = OptimizeDepsPlugin(nuxt)
    await (plugin.configEnvironment as any).call(null, name, config, {})
    return config
  }

  it('should rewrite include entries added after nuxt has built its config', async () => {
    const config = { optimizeDeps: { entries: [entry], include: ['layer-dep'] } }

    await configureEnvironment(createNuxt([installedLayer]), 'client', config)

    expect(config.optimizeDeps.include).toEqual(['installed-layer > layer-dep'])
    expect(config.optimizeDeps.entries).toEqual([entry, ...installedScanEntries(createNuxt([installedLayer]))])
  })

  it('should leave the server environment alone', async () => {
    const config = { optimizeDeps: { entries: [entry], include: ['layer-dep'] } }

    await configureEnvironment(createNuxt([installedLayer]), 'ssr', config)

    expect(config.optimizeDeps).toEqual({ entries: [entry], include: ['layer-dep'] })
  })

  it('should keep rewritten entries attributed to the user', async () => {
    const nuxt = createNuxt([installedLayer])
    userOptimizeDepsInclude.set(nuxt, ['layer-dep'])

    await configureEnvironment(nuxt, 'client', { optimizeDeps: { include: ['layer-dep', 'root-dep'] } })

    expect(userOptimizeDepsInclude.get(nuxt)).toEqual(['layer-dep', 'installed-layer > layer-dep'])
  })

  it('should attribute every resolved dependency copy to the user', async () => {
    const nuxt = createNuxt([parentLayer, nestedLayer, otherParentLayer, otherNestedLayer])
    userOptimizeDepsInclude.set(nuxt, ['nested-dep'])

    const config = await configureEnvironment(nuxt, 'client', { optimizeDeps: { include: ['nested-dep'] } })

    expect(userOptimizeDepsInclude.get(nuxt)).toEqual([
      'nested-dep',
      'parent-layer > nested-layer > nested-dep',
      'other-parent-layer > nested-layer > nested-dep',
    ])
    expect(config.optimizeDeps.include).toEqual(userOptimizeDepsInclude.get(nuxt)?.slice(1))
  })

  it('should scan components from installed layers', async () => {
    const nuxt = createNuxt([installedLayer], {
      default: {
        components: [
          { filePath: layerComponent },
          { filePath: unusedLayerComponent },
        ],
        plugins: [],
        middleware: [],
        layouts: {},
      },
    })
    const config = await configureEnvironment(nuxt, 'client', { optimizeDeps: { entries: [entry] } })

    const deps = await optimizedDeps(config.optimizeDeps)
    expect(deps).toEqual(expect.arrayContaining(['layer-component-dep', 'unused-layer-component-dep']))
  })
})

describe('createOptimizeDepsIncludeResolver', () => {
  it('should rewrite entries that only resolve from an installed layer', () => {
    const nuxt = createNuxt([installedLayer])

    expect(resolveOptimizeDepsInclude(nuxt, ['layer-dep'])).toEqual(['installed-layer > layer-dep'])
  })

  it('should rewrite packages without a manifest that resolve from an installed layer', () => {
    const nuxt = createNuxt([installedLayer])

    expect(resolveOptimizeDepsInclude(nuxt, ['manifestless-dep'])).toEqual(['installed-layer > manifestless-dep'])
  })

  it('should preserve the full package chain for nested installed layers', async () => {
    const nuxt = createNuxt([parentLayer, nestedLayer])

    const include = resolveOptimizeDepsInclude(nuxt, ['nested-dep'])

    expect(include).toEqual(['parent-layer > nested-layer > nested-dep'])
    await expect(optimizedDeps({ include })).resolves.toContain('parent-layer > nested-layer > nested-dep')
  })

  it('should resolve a layer rooted within an installed package', () => {
    const nuxt = createNuxt([subpathLayer])

    expect(resolveOptimizeDepsInclude(nuxt, ['subpath-dep'])).toEqual(['subpath-layer > subpath-dep'])
  })

  it('should use the installed alias as the parent package name', () => {
    const nuxt = createNuxt([aliasedLayer])

    expect(resolveOptimizeDepsInclude(nuxt, ['aliased-dep'])).toEqual(['aliased-layer > aliased-dep'])
  })

  it('should preserve separate dependency copies from different parent layers', async () => {
    const nuxt = createNuxt([parentLayer, nestedLayer, otherParentLayer, otherNestedLayer])

    const include = resolveOptimizeDepsInclude(nuxt, ['nested-dep'])

    expect(include).toEqual([
      'parent-layer > nested-layer > nested-dep',
      'other-parent-layer > nested-layer > nested-dep',
    ])
    await expect(optimizedDeps({ include })).resolves.toEqual(expect.arrayContaining(include))
  })

  it('should preserve separate dependency copies from the project and a nested layer', async () => {
    const nuxt = createNuxt([parentLayer, nestedLayer])

    const include = resolveOptimizeDepsInclude(nuxt, ['root-dep'])

    expect(include).toEqual([
      'root-dep',
      'parent-layer > nested-layer > root-dep',
    ])
    await expect(optimizedDeps({ include })).resolves.toEqual(expect.arrayContaining(include))
  })

  it('should follow Vite symlink identity when deduplicating dependency copies', async () => {
    const nuxt = createNuxt([parentLayer, nestedLayer])

    expect(resolveOptimizeDepsInclude(nuxt, ['linked-dep'])).toEqual(['linked-dep'])

    const include = resolveOptimizeDepsInclude(nuxt, ['linked-dep'], { preserveSymlinks: true })
    expect(include).toEqual([
      'linked-dep',
      'parent-layer > nested-layer > linked-dep',
    ])
    await expect(optimizedDeps({ include, preserveSymlinks: true })).resolves.toEqual(expect.arrayContaining(include))
  })

  it('should resolve reachable layer cycles independent of layer order', () => {
    const nuxt = createNuxt([cycleLayerB, cycleLayerA, reachableCycleLayer])

    expect(resolveOptimizeDepsInclude(nuxt, ['cycle-dep-b', 'cycle-dep-a'])).toEqual([
      'reachable-cycle-layer > cycle-layer-b > cycle-dep-b',
      'reachable-cycle-layer > cycle-layer-b > cycle-layer-a > cycle-dep-a',
    ])
  })

  it('should leave entries that resolve from the project root untouched', () => {
    const nuxt = createNuxt([installedLayer])

    expect(resolveOptimizeDepsInclude(nuxt, ['root-dep'])).toEqual(['root-dep'])
  })

  it('should leave unresolvable, nested and path entries untouched', () => {
    const nuxt = createNuxt([installedLayer])
    const include = ['does-not-exist', 'some-pkg > layer-dep', './local-file.js', join(rootDir, 'absolute.js')]

    expect(resolveOptimizeDepsInclude(nuxt, include)).toEqual(include)
  })

  it('should not rewrite anything when there are no installed layers', () => {
    const nuxt = createNuxt([{ app: join(rootDir, 'layers/local/app/'), root: join(rootDir, 'layers/local/') }])

    expect(resolveOptimizeDepsInclude(nuxt, ['layer-dep'])).toEqual(['layer-dep'])
  })
})
