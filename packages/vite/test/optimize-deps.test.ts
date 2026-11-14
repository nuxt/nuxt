import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { dirname, join } from 'pathe'
import { createServer } from 'vite'
import type { Plugin } from 'vite'
import type { Nuxt, NuxtApp } from '@nuxt/schema'

import { appScanEntries, resolveOptimizeDepsInclude } from '../src/utils/optimize-deps.ts'
import { OptimizeDepsPlugin } from '../src/plugins/optimize-deps.ts'
import { userOptimizeDepsInclude } from '../src/plugins/optimize-deps-hint.ts'

const rootDir = await mkdtemp(join(tmpdir(), 'nuxt-optimize-deps-'))
const srcDir = join(rootDir, 'app/')
const layerRoot = join(rootDir, 'node_modules/installed-layer/')
const layerSrcDir = join(layerRoot, 'app/')
const aliasLayerRoot = join(rootDir, 'node_modules/alias-layer/')
const aliasLayerSrcDir = join(aliasLayerRoot, 'app/')
const aliasLayerCard = join(aliasLayerSrcDir, 'components/LayerCard.vue')
const moduleRuntime = join(rootDir, 'node_modules/installed-module/runtime/')
const importsModuleRoot = join(rootDir, 'node_modules/installed-imports-module/')
const importsModulePlugin = join(importsModuleRoot, 'runtime/plugin.mjs')
const ownComponentsRoot = join(rootDir, 'node_modules/installed-own-components/')
const ownComponentsPlugin = join(ownComponentsRoot, 'runtime/plugin.mjs')
const localComponentsRoot = join(rootDir, 'layers/local-components/')
const localComponentsPlugin = join(localComponentsRoot, 'plugin.mjs')
const localLayerRoot = join(rootDir, 'layers/local/')
const localLayerSrcDir = join(localLayerRoot, 'app/')
const flatRootDir = join(rootDir, 'flat/')
const entry = join(srcDir, 'entry.mjs')
const componentsEntry = join(srcDir, 'components-entry.mjs')

const files: Record<string, string> = {
  [join(srcDir, 'app.vue')]: 'app-dep',
  [join(srcDir, 'app.config.mjs')]: 'app-config-dep',
  [join(srcDir, 'pages/index.vue')]: 'page-dep',
  [join(srcDir, 'pages/[id].vue')]: 'dynamic-page-dep',
  [join(srcDir, 'pages/(marketing)/about.vue')]: 'grouped-page-dep',
  [join(srcDir, 'pages/(marketing)/pricing.vue')]: 'grouped-pricing-page-dep',
  [join(srcDir, 'pages/parent/child.vue')]: 'child-page-dep',
  [join(srcDir, 'pages/parent/child@sidebar.vue')]: 'named-view-dep',
  [join(srcDir, 'pages/admin.server.vue')]: 'server-page-dep',
  [join(srcDir, 'layouts/default.vue')]: 'root-layout-dep',
  [join(srcDir, 'middleware/auth.mjs')]: 'root-middleware-dep',
  [join(srcDir, 'components/Card.vue')]: 'root-component-dep',
  [join(srcDir, 'components/Unregistered.vue')]: 'unregistered-dep',
  [join(srcDir, 'components/Highlight.server.vue')]: 'server-component-dep',
  [join(srcDir, 'components/islands/Chart.vue')]: 'island-dep',
  [join(srcDir, 'plugins/client.mjs')]: 'root-plugin-dep',
  [join(srcDir, 'plugins/files.server.mjs')]: 'node-only-dep',
  [join(srcDir, 'plugins/stale.mjs')]: 'not-installed-dep',
  [join(srcDir, 'composables/useThing.mjs')]: 'composable-dep',
  [join(srcDir, 'composables/nested/useNested.mjs')]: 'nested-composable-dep',
  [join(srcDir, 'composables/feature/index.mjs')]: 'index-composable-dep',
  [join(srcDir, 'composables/useThing.spec.ts')]: 'test-only-dep',
  [join(srcDir, 'composables/useDraft.mjs')]: 'nuxtignore-only-dep',
  [join(srcDir, 'utils/format.mjs')]: 'util-dep',
  [join(rootDir, 'shared/utils/shared.mjs')]: 'shared-util-dep',
  [join(localLayerSrcDir, 'plugins/local.mjs')]: 'local-layer-dep',
  [join(layerSrcDir, 'composables/useLayer.mjs')]: 'layer-composable-dep',
  [join(aliasLayerSrcDir, 'utils/internal/helper.mjs')]: 'layer-alias-dep',
  [join(layerSrcDir, 'plugins/files.server.mjs')]: 'layer-server-only-dep',
  [join(flatRootDir, 'components/Flat.vue')]: 'flat-dep',
  [join(flatRootDir, 'composables/useFlat.mjs')]: 'flat-composable-dep',
  [join(flatRootDir, 'scripts/release.mjs')]: 'script-only-dep',
  [join(flatRootDir, 'server/api/data.mjs')]: 'server-only-dep',
}

const registered = {
  plugins: [{ src: join(moduleRuntime, 'plugin.mjs') }],
  components: [{ filePath: join(moduleRuntime, 'Component.vue') }] as NuxtApp['components'],
  middleware: [{ name: 'installed', path: join(moduleRuntime, 'middleware.mjs'), global: false }],
  layouts: { installed: { name: 'installed', file: join(moduleRuntime, 'layout.vue') } },
} satisfies Partial<NuxtApp>

const rootApp: Partial<NuxtApp> = {
  mainComponent: join(srcDir, 'app.vue'),
  configs: [join(srcDir, 'app.config.mjs')],
  pages: [
    { path: '/', file: join(srcDir, 'pages/index.vue') },
    { path: '/:id', file: join(srcDir, 'pages/[id].vue') },
    { path: '/about', file: join(srcDir, 'pages/(marketing)/about.vue') },
    { path: '/pricing', file: join(srcDir, 'pages/(marketing)/pricing.vue') },
    { path: '/parent', children: [{ path: 'child', file: join(srcDir, 'pages/parent/child.vue'), components: { sidebar: join(srcDir, 'pages/parent/child@sidebar.vue') } }] },
    { path: '/admin', file: join(srcDir, 'pages/admin.server.vue'), mode: 'server' },
  ],
  layouts: { default: { name: 'default', file: join(srcDir, 'layouts/default.vue') } },
  middleware: [{ name: 'auth', path: join(srcDir, 'middleware/auth.mjs'), global: false }],
  components: [
    { filePath: join(srcDir, 'components/Card.vue'), mode: 'all' },
    { filePath: join(srcDir, 'components/Highlight.server.vue'), mode: 'server' },
    { filePath: join(srcDir, 'components/islands/Chart.vue'), mode: 'server', island: true },
  ] as NuxtApp['components'],
  plugins: [
    { src: join(srcDir, 'plugins/client.mjs'), mode: 'all' },
    { src: join(srcDir, 'plugins/files.server.mjs'), mode: 'server' },
  ],
}

async function writePackage (dir: string, name: string, contents: string, main = 'index.mjs') {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', type: main.endsWith('.mjs') ? 'module' : 'commonjs', main }))
  await writeFile(join(dir, main), contents)
}

await mkdir(join(layerSrcDir, 'plugins'), { recursive: true })
await mkdir(srcDir, { recursive: true })
await writeFile(join(rootDir, 'package.json'), JSON.stringify({ name: 'fixture', type: 'module', imports: { '#shared/*': './shared/*' } }))
await writeFile(join(rootDir, '.nuxtignore'), 'app/composables/useDraft.mjs\n')
await writeFile(entry, 'export default 1\n')
await writeFile(componentsEntry, 'import { NuxtLink } from \'#components\'\nimport x from \'root-dep\'\nexport default [NuxtLink, x]\n')
await writeFile(join(layerRoot, 'package.json'), JSON.stringify({ name: 'installed-layer', type: 'module' }))
await writeFile(join(layerSrcDir, 'plugins/broken.mjs'), 'import { hello } from \'layer-dep\'\nexport default hello\n')
await writePackage(join(layerRoot, 'node_modules/layer-dep'), 'layer-dep', 'import cjs from \'cjs-only\'\nexport const hello = () => cjs()\n')
await writePackage(join(layerRoot, 'node_modules/cjs-only'), 'cjs-only', 'module.exports = () => \'hi\'\n', 'index.js')
await writePackage(join(layerRoot, 'node_modules/hoisted-dep'), 'hoisted-dep', 'export default 1\n')
await writePackage(join(layerSrcDir, 'node_modules/nested-pkg'), 'nested-pkg', 'import x from \'hoisted-dep\'\nexport default x\n')
await writePackage(join(rootDir, 'node_modules/root-dep'), 'root-dep', 'export default 1\n')

await mkdir(moduleRuntime, { recursive: true })
await writeFile(join(moduleRuntime, 'plugin.mjs'), 'import x from \'plugin-dep\'\nexport default x\n')
await writeFile(join(moduleRuntime, 'Component.vue'), '<script setup>\nimport x from \'component-dep\'\n</script>\n')
await writeFile(join(moduleRuntime, 'middleware.mjs'), 'import x from \'middleware-dep\'\nexport default x\n')
await writeFile(join(moduleRuntime, 'layout.vue'), '<script setup>\nimport x from \'layout-dep\'\n</script>\n')
await mkdir(join(importsModuleRoot, 'runtime'), { recursive: true })
await writeFile(join(importsModuleRoot, 'package.json'), JSON.stringify({ name: 'installed-imports-module', type: 'module', imports: { '#internal': './runtime/internal.mjs' } }))
await writeFile(join(importsModuleRoot, 'runtime/internal.mjs'), 'import x from \'internal-dep\'\nexport default x\n')
await writeFile(importsModulePlugin, 'import internal from \'#internal\'\nimport missing from \'#missing\'\nimport x from \'imports-module-dep\'\nexport default [internal, missing, x]\n')
await mkdir(join(ownComponentsRoot, 'runtime'), { recursive: true })
await writeFile(join(ownComponentsRoot, 'package.json'), JSON.stringify({ name: 'installed-own-components', type: 'module', imports: { '#components': './runtime/components.mjs' } }))
await writeFile(join(ownComponentsRoot, 'runtime/components.mjs'), 'export { default as Own } from \'own-components-dep\'\n')
await writeFile(ownComponentsPlugin, 'import { Own } from \'#components\'\nexport default Own\n')
await mkdir(localComponentsRoot, { recursive: true })
await writeFile(join(localComponentsRoot, 'package.json'), JSON.stringify({ name: 'local-components', type: 'module', imports: { '#components': './components.mjs' } }))
await writeFile(join(localComponentsRoot, 'components.mjs'), 'export { default as Local } from \'local-components-dep\'\n')
await writeFile(localComponentsPlugin, 'import { Local } from \'#components\'\nimport x from \'root-dep\'\nexport default [Local, x]\n')

await mkdir(dirname(aliasLayerCard), { recursive: true })
await writeFile(aliasLayerCard, '<script setup>\nimport helper from \'@/utils/internal/helper.mjs\'\n</script>\n')
for (const [file, dep] of Object.entries(files)) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, file.endsWith('.vue') ? `<script setup>\nimport x from '${dep}'\n</script>\n` : `import x from '${dep}'\nexport default x\n`)
}
for (const dep of [...Object.values(files), 'plugin-dep', 'component-dep', 'middleware-dep', 'layout-dep', 'imports-module-dep', 'internal-dep', 'own-components-dep', 'local-components-dep']) {
  if (dep !== 'not-installed-dep' && dep !== 'node-only-dep') {
    await writePackage(join(rootDir, 'node_modules', dep), dep, 'export default 1\n')
  }
}
await writeFile(join(srcDir, 'plugins/files.server.mjs'), 'import { toPath } from \'node-only-dep\'\nexport default toPath\n')
await mkdir(join(rootDir, 'node_modules/node-only-dep'), { recursive: true })
await writeFile(join(rootDir, 'node_modules/node-only-dep/package.json'), JSON.stringify({ name: 'node-only-dep', type: 'module', exports: { browser: './browser.mjs', default: './node.mjs' } }))
await writeFile(join(rootDir, 'node_modules/node-only-dep/browser.mjs'), 'export const other = 1\n')
await writeFile(join(rootDir, 'node_modules/node-only-dep/node.mjs'), 'export const toPath = p => p\n')

afterAll(() => rm(rootDir, { recursive: true, force: true }))

interface NuxtOptions {
  layers?: Array<{ app: string, root: string, imports?: Record<string, unknown> }>
  app?: Partial<NuxtApp>
  rootDir?: string
  srcDir?: string
  imports?: Record<string, unknown>
}

function createNuxt ({ layers = [], app = {}, rootDir: root = rootDir, srcDir: src = srcDir, imports = {} }: NuxtOptions = {}) {
  return {
    apps: { default: { components: [], plugins: [], middleware: [], layouts: {}, configs: [], ...app } },
    options: {
      rootDir: root,
      srcDir: src,
      alias: {},
      imports,
      ignore: ['**/*.{spec,test}.{js,cts,mts,ts,jsx,tsx}'],
      _layers: [
        { cwd: root, config: { rootDir: root, srcDir: src, imports } },
        ...layers.map(dirs => ({ cwd: dirs.root, config: { rootDir: dirs.root, srcDir: dirs.app, imports: dirs.imports } })),
      ],
    },
  } as unknown as Nuxt
}

const installedLayer = { app: layerSrcDir, root: layerRoot }

async function optimizedDeps (options: { entries?: string[], include?: string[], plugins?: Plugin[] }) {
  const server = await createServer({
    root: srcDir,
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
    plugins: options.plugins,
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

describe('appScanEntries', () => {
  it('should scan the files nuxt registers', async () => {
    const deps = await optimizedDeps({ entries: await appScanEntries(createNuxt({ app: rootApp })) })

    expect(deps).toEqual(expect.arrayContaining([
      'app-dep',
      'app-config-dep',
      'page-dep',
      'dynamic-page-dep',
      'grouped-page-dep',
      'grouped-pricing-page-dep',
      'child-page-dep',
      'named-view-dep',
      'root-layout-dep',
      'root-middleware-dep',
      'root-component-dep',
      'root-plugin-dep',
    ]))
    expect(deps).not.toContain('unregistered-dep')
  })

  it('should not scan server-only pages, components and plugins', async () => {
    const deps = await optimizedDeps({ plugins: [OptimizeDepsPlugin(createNuxt({ app: rootApp }))] })

    expect(deps).toContain('root-plugin-dep')
    expect(deps).not.toContain('server-page-dep')
    expect(deps).not.toContain('server-component-dep')
    expect(deps).not.toContain('island-dep')
    expect(deps).not.toContain('node-only-dep')
  })

  it('should scan auto-imported composables and utils', async () => {
    const deps = await optimizedDeps({ entries: await appScanEntries(createNuxt()) })

    expect(deps).toEqual(expect.arrayContaining(['composable-dep', 'util-dep', 'shared-util-dep']))
    expect(deps).not.toContain('nested-composable-dep')
    expect(deps).not.toContain('test-only-dep')
    expect(deps).not.toContain('nuxtignore-only-dep')
  })

  it('should scan the imports dirs a layer configures', async () => {
    const deps = await optimizedDeps({ entries: await appScanEntries(createNuxt({ imports: { dirs: ['composables/**'] } })) })

    expect(deps).toEqual(expect.arrayContaining(['composable-dep', 'nested-composable-dep']))
  })

  it('should scan imports dirs given as file globs', async () => {
    const deps = await optimizedDeps({ entries: await appScanEntries(createNuxt({ imports: { dirs: ['composables/*/index.{ts,mjs}'] } })) })

    expect(deps).toContain('index-composable-dep')
    expect(deps).not.toContain('nested-composable-dep')
  })

  it('should not scan auto-imports when scanning is disabled', async () => {
    await expect(appScanEntries(createNuxt({ imports: { scan: false } }))).resolves.toEqual([])
  })

  it('should only scan registered files of a project without an `app/` directory', async () => {
    const nuxt = createNuxt({
      rootDir: flatRootDir,
      srcDir: flatRootDir,
      app: { components: [{ filePath: join(flatRootDir, 'components/Flat.vue') }] as NuxtApp['components'] },
    })

    const deps = await optimizedDeps({ entries: await appScanEntries(nuxt) })

    expect(deps).toEqual(expect.arrayContaining(['flat-dep', 'flat-composable-dep']))
    expect(deps).not.toContain('script-only-dep')
    expect(deps).not.toContain('server-only-dep')
  })

  it('should keep scanning when a registered file imports a package that is not installed', async () => {
    const nuxt = createNuxt({ app: { plugins: [{ src: join(srcDir, 'plugins/stale.mjs') }, { src: join(srcDir, 'plugins/client.mjs') }] } })

    await expect(optimizedDeps({ plugins: [OptimizeDepsPlugin(nuxt)] })).resolves.toContain('root-plugin-dep')
  })

  it('should scan files of a local layer', async () => {
    const nuxt = createNuxt({ layers: [{ app: localLayerSrcDir, root: localLayerRoot }], app: { plugins: [{ src: join(localLayerSrcDir, 'plugins/local.mjs') }] } })

    await expect(optimizedDeps({})).resolves.not.toContain('local-layer-dep')
    await expect(optimizedDeps({ plugins: [OptimizeDepsPlugin(nuxt)] })).resolves.toContain('local-layer-dep')
  })

  it('should pre-bundle dependencies only reachable through an installed layer', async () => {
    await expect(optimizedDeps({})).resolves.toEqual([])
    await expect(optimizedDeps({ entries: await appScanEntries(createNuxt({ layers: [installedLayer] })) })).resolves.toEqual(expect.arrayContaining(['layer-dep', 'layer-composable-dep']))
  })

  it('should scan installed layer files that are only reached through an alias', async () => {
    const nuxt = createNuxt({ layers: [{ app: aliasLayerSrcDir, root: aliasLayerRoot }], app: { components: [{ filePath: aliasLayerCard }] as NuxtApp['components'] } })

    await expect(optimizedDeps({ plugins: [OptimizeDepsPlugin(nuxt)] })).resolves.toContain('layer-alias-dep')
  })

  it('should not scan server-only files of an installed layer', async () => {
    const nuxt = createNuxt({ layers: [installedLayer], app: { plugins: [{ src: join(layerSrcDir, 'plugins/files.server.mjs'), mode: 'server' }] } })

    const deps = await optimizedDeps({ entries: await appScanEntries(nuxt) })

    expect(deps).toContain('layer-composable-dep')
    expect(deps).not.toContain('layer-server-only-dep')
  })

  it('should not scan dependencies nested within an installed layer', async () => {
    const entries = await appScanEntries(createNuxt({ layers: [installedLayer] }))

    await expect(optimizedDeps({ entries: entries.filter(e => !e.startsWith('!')) })).resolves.toContain('hoisted-dep')
    await expect(optimizedDeps({ entries })).resolves.not.toContain('hoisted-dep')
  })

  it('should group the files of a directory into one scan entry', async () => {
    await expect(appScanEntries(createNuxt({ app: registered, imports: { scan: false } }))).resolves.toHaveLength(1)
  })

  it('should scan app files that modules register from within node_modules', async () => {
    const nuxt = createNuxt({ app: registered, imports: { scan: false } })

    await expect(optimizedDeps({ entries: [entry, ...await appScanEntries(nuxt)] })).resolves.toEqual(
      expect.arrayContaining(['plugin-dep', 'component-dep', 'middleware-dep', 'layout-dep']),
    )
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

    await configureEnvironment(createNuxt({ layers: [installedLayer] }), 'client', config)

    expect(config.optimizeDeps.include).toEqual(['installed-layer > layer-dep'])
    expect(config.optimizeDeps.entries).toEqual([entry, ...await appScanEntries(createNuxt({ layers: [installedLayer] }))])
  })

  it('should leave the server environment alone', async () => {
    const config = { optimizeDeps: { entries: [entry], include: ['layer-dep'] } }

    await configureEnvironment(createNuxt({ layers: [installedLayer] }), 'ssr', config)

    expect(config.optimizeDeps).toEqual({ entries: [entry], include: ['layer-dep'] })
  })

  it('should leave resolution outside the dependency scan alone', async () => {
    const hook = OptimizeDepsPlugin(createNuxt()).resolveId as { handler: (...args: any[]) => Promise<unknown> }
    const resolve = vi.fn()

    await expect(hook.handler.call({ resolve }, '#components', componentsEntry, {})).resolves.toBeUndefined()
    await expect(hook.handler.call({ resolve }, 'root-dep', componentsEntry, {})).resolves.toBeUndefined()
    expect(resolve).not.toHaveBeenCalled()
  })

  it('should exclude `#components` from the dependency scan', async () => {
    const entries = [entry, componentsEntry]

    await expect(optimizedDeps({ entries })).resolves.not.toContain('root-dep')
    await expect(optimizedDeps({ entries, plugins: [OptimizeDepsPlugin(createNuxt())] })).resolves.toContain('root-dep')
  })

  it('should scan `#components` through an installed package\'s own subpath import', async () => {
    await expect(optimizedDeps({ entries: [entry, ownComponentsPlugin], plugins: [OptimizeDepsPlugin(createNuxt())] })).resolves.toContain('own-components-dep')
  })

  it('should exclude `#components` from the dependency scan within the project even when its package maps it', async () => {
    const deps = await optimizedDeps({ entries: [entry, localComponentsPlugin], plugins: [OptimizeDepsPlugin(createNuxt())] })

    expect(deps).toContain('root-dep')
    expect(deps).not.toContain('local-components-dep')
  })

  it('should exclude `#` imports that fail to resolve from the dependency scan', async () => {
    const entries = [entry, importsModulePlugin]

    await expect(optimizedDeps({ entries })).resolves.not.toContain('imports-module-dep')
    await expect(optimizedDeps({ entries, plugins: [OptimizeDepsPlugin(createNuxt())] })).resolves.toEqual(
      expect.arrayContaining(['imports-module-dep', 'internal-dep']),
    )
  })

  it('should keep rewritten entries attributed to the user', async () => {
    const nuxt = createNuxt({ layers: [installedLayer] })
    userOptimizeDepsInclude.set(nuxt, ['layer-dep'])

    await configureEnvironment(nuxt, 'client', { optimizeDeps: { include: ['layer-dep', 'root-dep'] } })

    expect(userOptimizeDepsInclude.get(nuxt)).toEqual(['layer-dep', 'installed-layer > layer-dep'])
  })
})

describe('resolveOptimizeDepsInclude', () => {
  it('should rewrite entries that only resolve from an installed layer', async () => {
    const nuxt = createNuxt({ layers: [installedLayer] })

    await expect(resolveOptimizeDepsInclude(nuxt, ['layer-dep'])).resolves.toEqual(['installed-layer > layer-dep'])
  })

  it('should pre-bundle rewritten entries that vite cannot resolve as-is', async () => {
    await expect(optimizedDeps({ include: ['layer-dep'] })).resolves.not.toContain('layer-dep')

    await expect(optimizedDeps({ include: ['installed-layer > layer-dep'] })).resolves.toContain('installed-layer > layer-dep')
  })

  it('should leave entries that resolve from the project root untouched', async () => {
    const nuxt = createNuxt({ layers: [installedLayer] })

    await expect(resolveOptimizeDepsInclude(nuxt, ['root-dep'])).resolves.toEqual(['root-dep'])
  })

  it('should leave unresolvable, nested and path entries untouched', async () => {
    const nuxt = createNuxt({ layers: [installedLayer] })
    const include = ['does-not-exist', 'some-pkg > layer-dep', './local-file.js', join(rootDir, 'absolute.js')]

    await expect(resolveOptimizeDepsInclude(nuxt, include)).resolves.toEqual(include)
  })

  it('should not rewrite anything when there are no installed layers', async () => {
    const nuxt = createNuxt({ layers: [{ app: localLayerSrcDir, root: localLayerRoot }] })

    await expect(resolveOptimizeDepsInclude(nuxt, ['layer-dep'])).resolves.toEqual(['layer-dep'])
  })
})
