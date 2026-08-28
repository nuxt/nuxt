import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { afterAll, describe, expect, it } from 'vitest'
import { join } from 'pathe'
import { createServer } from 'vite'
import type { Nuxt } from '@nuxt/schema'

import { installedLayerScanEntries, resolveOptimizeDepsInclude } from '../src/utils/layer-deps.ts'
import { LayerDepOptimizePlugin } from '../src/plugins/layer-dep-optimize.ts'
import { userOptimizeDepsInclude } from '../src/plugins/optimize-deps-hint.ts'

const rootDir = await mkdtemp(join(tmpdir(), 'nuxt-optimize-deps-'))
const srcDir = join(rootDir, 'app/')
const layerRoot = join(rootDir, 'node_modules/installed-layer/')
const layerSrcDir = join(layerRoot, 'app/')
const entry = join(srcDir, 'entry.mjs')

async function writePackage (dir: string, name: string, contents: string, main = 'index.mjs') {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', type: main.endsWith('.mjs') ? 'module' : 'commonjs', main }))
  await writeFile(join(dir, main), contents)
}

await mkdir(join(layerSrcDir, 'plugins'), { recursive: true })
await mkdir(srcDir, { recursive: true })
await writeFile(join(rootDir, 'package.json'), JSON.stringify({ name: 'fixture', type: 'module' }))
await writeFile(entry, 'export default 1\n')
await writeFile(join(layerRoot, 'package.json'), JSON.stringify({ name: 'installed-layer', type: 'module' }))
await writeFile(join(layerSrcDir, 'plugins/broken.mjs'), 'import { hello } from \'layer-dep\'\nexport default hello\n')
await writePackage(join(layerRoot, 'node_modules/layer-dep'), 'layer-dep', 'import cjs from \'cjs-only\'\nexport const hello = () => cjs()\n')
await writePackage(join(layerRoot, 'node_modules/cjs-only'), 'cjs-only', 'module.exports = () => \'hi\'\n', 'index.js')
await writePackage(join(layerRoot, 'node_modules/hoisted-dep'), 'hoisted-dep', 'export default 1\n')
await writePackage(join(layerSrcDir, 'node_modules/nested-pkg'), 'nested-pkg', 'import x from \'hoisted-dep\'\nexport default x\n')
await writePackage(join(rootDir, 'node_modules/root-dep'), 'root-dep', 'export default 1\n')

afterAll(() => rm(rootDir, { recursive: true, force: true }))

function createNuxt (layerDirs: Array<{ app: string, root: string }> = []) {
  return {
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

async function optimizedDeps (options: { entries?: string[], include?: string[] }) {
  const server = await createServer({
    root: rootDir,
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true },
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

describe('installedLayerScanEntries', () => {
  it('should not scan layers that are part of the project', () => {
    const nuxt = createNuxt([{ app: join(rootDir, 'layers/local/app/'), root: join(rootDir, 'layers/local/') }])

    expect(installedLayerScanEntries(nuxt)).toEqual([])
  })

  it('should pre-bundle dependencies only reachable through an installed layer', async () => {
    await expect(optimizedDeps({})).resolves.toEqual([])

    const entries = [entry, ...installedLayerScanEntries(createNuxt([installedLayer]))]

    await expect(optimizedDeps({ entries })).resolves.toContain('layer-dep')
  })

  it('should not scan dependencies nested within the layer', async () => {
    const entries = installedLayerScanEntries(createNuxt([installedLayer]))

    await expect(optimizedDeps({ entries: [entry, ...entries.filter(e => !e.startsWith('!'))] })).resolves.toContain('hoisted-dep')
    await expect(optimizedDeps({ entries: [entry, ...entries] })).resolves.not.toContain('hoisted-dep')
  })
})

describe('LayerDepOptimizePlugin', () => {
  async function configureEnvironment (nuxt: Nuxt, name: string, config: Record<string, any>) {
    const plugin = LayerDepOptimizePlugin(nuxt)
    await (plugin.configEnvironment as any).call(null, name, config, {})
    return config
  }

  it('should keep its plugin name', () => {
    expect(LayerDepOptimizePlugin(createNuxt()).name).toBe('nuxt:optimize-layer-deps')
  })

  it('should rewrite include entries added after nuxt has built its config', async () => {
    const config = { optimizeDeps: { entries: [entry], include: ['layer-dep'] } }

    await configureEnvironment(createNuxt([installedLayer]), 'client', config)

    expect(config.optimizeDeps.include).toEqual(['installed-layer > layer-dep'])
    expect(config.optimizeDeps.entries).toEqual([entry, ...installedLayerScanEntries(createNuxt([installedLayer]))])
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
