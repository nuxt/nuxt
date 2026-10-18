import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { join } from 'pathe'
import { createServer } from 'vite'
import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'

import { installedScanEntries, resolveOptimizeDepsInclude } from '../src/utils/optimize-deps.ts'
import { OptimizeDepsPlugin } from '../src/plugins/optimize-deps.ts'
import { userOptimizeDepsInclude } from '../src/plugins/optimize-deps-hint.ts'

const rootDir = await mkdtemp(join(tmpdir(), 'nuxt-optimize-deps-'))
const srcDir = join(rootDir, 'app/')
const layerRoot = join(rootDir, 'node_modules/installed-layer/')
const layerSrcDir = join(layerRoot, 'app/')
const moduleRuntime = join(rootDir, 'node_modules/installed-module/runtime/')
const importsModuleRoot = join(rootDir, 'node_modules/installed-imports-module/')
const importsModulePlugin = join(importsModuleRoot, 'runtime/plugin.mjs')
const ownComponentsRoot = join(rootDir, 'node_modules/installed-own-components/')
const ownComponentsPlugin = join(ownComponentsRoot, 'runtime/plugin.mjs')
const localComponentsRoot = join(rootDir, 'layers/local-components/')
const localComponentsPlugin = join(localComponentsRoot, 'plugin.mjs')
const entry = join(srcDir, 'entry.mjs')
const componentsEntry = join(srcDir, 'components-entry.mjs')

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
await mkdir(srcDir, { recursive: true })
await writeFile(join(rootDir, 'package.json'), JSON.stringify({ name: 'fixture', type: 'module', imports: { '#shared/*': './shared/*' } }))
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
for (const dep of ['plugin-dep', 'component-dep', 'middleware-dep', 'layout-dep', 'imports-module-dep', 'internal-dep', 'own-components-dep', 'local-components-dep']) {
  await writePackage(join(rootDir, 'node_modules', dep), dep, 'export default 1\n')
}

afterAll(() => rm(rootDir, { recursive: true, force: true }))

function createNuxt (layerDirs: Array<{ app: string, root: string }> = [], apps: Record<string, any> = { default: { components: [], plugins: [], middleware: [], layouts: {} } }) {
  return {
    apps,
    options: {
      rootDir,
      srcDir,
      alias: {},
      _layers: [
        { cwd: rootDir, config: { rootDir, srcDir } },
        ...layerDirs.map(dirs => ({ cwd: dirs.root, config: { rootDir: dirs.root, srcDir: dirs.app } })),
      ],
    },
  } as unknown as Nuxt
}

const installedLayer = { app: layerSrcDir, root: layerRoot }

async function optimizedDeps (options: { entries?: string[], include?: string[], plugins?: Plugin[] }) {
  const server = await createServer({
    root: rootDir,
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

  it('should scan app files that modules register from within node_modules', async () => {
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

  it('should keep its plugin name', () => {
    expect(OptimizeDepsPlugin(createNuxt()).name).toBe('nuxt:optimize-deps')
  })

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

  it('should leave resolution outside the dependency scan alone', async () => {
    const hook = OptimizeDepsPlugin(createNuxt()).resolveId as { handler: (...args: any[]) => Promise<unknown> }
    const resolve = vi.fn()

    await expect(hook.handler.call({ resolve }, '#components', componentsEntry, {})).resolves.toBeUndefined()
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
    const nuxt = createNuxt([installedLayer])
    userOptimizeDepsInclude.set(nuxt, ['layer-dep'])

    await configureEnvironment(nuxt, 'client', { optimizeDeps: { include: ['layer-dep', 'root-dep'] } })

    expect(userOptimizeDepsInclude.get(nuxt)).toEqual(['layer-dep', 'installed-layer > layer-dep'])
  })
})

describe('resolveOptimizeDepsInclude', () => {
  it('should rewrite entries that only resolve from an installed layer', async () => {
    const nuxt = createNuxt([installedLayer])

    await expect(resolveOptimizeDepsInclude(nuxt, ['layer-dep'])).resolves.toEqual(['installed-layer > layer-dep'])
  })

  it('should pre-bundle rewritten entries that vite cannot resolve as-is', async () => {
    await expect(optimizedDeps({ include: ['layer-dep'] })).resolves.not.toContain('layer-dep')

    await expect(optimizedDeps({ include: ['installed-layer > layer-dep'] })).resolves.toContain('installed-layer > layer-dep')
  })

  it('should leave entries that resolve from the project root untouched', async () => {
    const nuxt = createNuxt([installedLayer])

    await expect(resolveOptimizeDepsInclude(nuxt, ['root-dep'])).resolves.toEqual(['root-dep'])
  })

  it('should leave unresolvable, nested and path entries untouched', async () => {
    const nuxt = createNuxt([installedLayer])
    const include = ['does-not-exist', 'some-pkg > layer-dep', './local-file.js', join(rootDir, 'absolute.js')]

    await expect(resolveOptimizeDepsInclude(nuxt, include)).resolves.toEqual(include)
  })

  it('should not rewrite anything when there are no installed layers', async () => {
    const nuxt = createNuxt([{ app: join(rootDir, 'layers/local/app/'), root: join(rootDir, 'layers/local/') }])

    await expect(resolveOptimizeDepsInclude(nuxt, ['layer-dep'])).resolves.toEqual(['layer-dep'])
  })
})
