import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'pathe'
import { createServer } from 'vite'
import type { NuxtConfigLayer } from 'nuxt/schema'
import type { UnpluginContextMeta } from 'unplugin'
import { afterAll, describe, expect, it, onTestFinished } from 'vitest'

import { LayerAliasingPlugin } from '../src/core/plugins/layer-aliasing'
import { matchesIdFilter } from './utils.ts'

interface TransformHandler {
  (this: unknown, code: string, id: string): { code: string } | undefined
}

interface RawPlugin {
  transform?: { filter: { id: RegExp | RegExp[] | { include?: RegExp | RegExp[], exclude?: RegExp | RegExp[] } }, handler: TransformHandler }
  vite?: { resolveId: { handler: (id: string, importer?: string) => unknown } }
}

function makeLayer (cwd: string): NuxtConfigLayer {
  return { cwd, config: { srcDir: cwd, rootDir: cwd } } as NuxtConfigLayer
}

function createPlugin (layers: NuxtConfigLayer[], framework: 'vite' | 'webpack' = 'vite') {
  const meta = { framework, webpack: { compiler: {} } } as unknown as UnpluginContextMeta
  const raw = LayerAliasingPlugin({ root: '/', dev: false, layers }).raw({}, meta)
  const entry = (Array.isArray(raw) ? raw[0] : raw) as RawPlugin
  const resolve = (id: string) => ({ id })
  return {
    transformInclude: (id: string) => matchesIdFilter(entry.transform!.filter.id, id),
    transform: (code: string, id: string) => entry.transform!.handler.call({}, code, id),
    resolveId: (id: string, importer?: string) => entry.vite!.resolveId.handler.call({ resolve }, id, importer),
  }
}

describe('LayerAliasingPlugin transform', () => {
  const layerDir = '/abs/layer'
  const otherLayerDir = '/abs/other-layer'

  it('rewrites quoted layer-relative aliases inside layer files', () => {
    const { transform } = createPlugin([makeLayer(layerDir)])

    const result = transform(
      `@use '@/styles/global' as g;\n@import "~/styles/extra";`,
      `${layerDir}/components/UiButton.vue`,
    )

    expect(result?.code).toBe(`@use '${layerDir}/styles/global' as g;\n@import "${layerDir}/styles/extra";`)
  })

  it('rewrites url() references that use quoted aliases', () => {
    const { transform } = createPlugin([makeLayer(layerDir)])

    const result = transform(
      `.x { background-image: url('@/assets/icon.svg'); }`,
      `${layerDir}/components/UrlRef.vue`,
    )

    expect(result?.code).toBe(`.x { background-image: url('${layerDir}/assets/icon.svg'); }`)
  })

  it('handles `@@`/`~~` root aliases distinctly from `@`/`~`', () => {
    const layer: NuxtConfigLayer = {
      cwd: layerDir,
      config: { srcDir: `${layerDir}/src`, rootDir: layerDir },
    } as NuxtConfigLayer
    const { transform } = createPlugin([layer])

    const result = transform(
      `@use '@/a';\n@use '@@/b';`,
      `${layer.config.srcDir}/components/X.vue`,
    )

    expect(result?.code).toBe(`@use '${layerDir}/src/a';\n@use '${layerDir}/b';`)
  })

  it('picks the longest matching layer srcDir (nested layers)', () => {
    const parent = makeLayer('/abs')
    const child = makeLayer('/abs/nested')
    const { transform } = createPlugin([parent, child])

    const result = transform(
      `@use '@/foo';`,
      `/abs/nested/components/X.vue`,
    )

    expect(result?.code).toBe(`@use '/abs/nested/foo';`)
  })

  it('does not touch files outside any registered layer', () => {
    const { transform } = createPlugin([makeLayer(layerDir)])

    expect(transform(`@use '@/styles/global';`, `/other/path/file.scss`)).toBeUndefined()
  })

  it.each(['vite', 'webpack'] as const)('on %s, excludes paths that only share a layer directory prefix', (framework) => {
    const { transformInclude, transform } = createPlugin([makeLayer(layerDir)], framework)

    const id = `${layerDir}-app/styles/global.scss`
    expect(transformInclude(id)).toBe(false)
    expect(transform(`@use '@/styles/global';`, id)).toBeUndefined()
  })

  it('matches Windows layer directories with a trailing separator', () => {
    const { transformInclude, transform } = createPlugin([makeLayer('C:\\abs\\layer\\')])

    const id = 'C:\\abs\\layer\\styles\\global.scss'
    expect(transformInclude(id)).toBe(true)
    expect(transform(`@use '@/styles/global';`, id)).toBeDefined()
  })

  it('does not touch unquoted occurrences (e.g. comments, identifiers)', () => {
    const { transform } = createPlugin([makeLayer(layerDir)])

    expect(transform(`// see @/styles/global for tokens`, `${layerDir}/file.ts`)).toBeUndefined()
  })

  it('runs the same way under non-vite frameworks', () => {
    const { transform } = createPlugin([makeLayer(layerDir)], 'webpack')

    const result = transform(
      `import x from '@/utils'`,
      `${layerDir}/components/X.vue`,
    )

    expect(result?.code).toBe(`import x from '${layerDir}/utils'`)
  })

  it('on vite, only transforms CSS-flavoured files inside a registered layer', () => {
    const { transformInclude } = createPlugin([makeLayer(layerDir), makeLayer(otherLayerDir)])

    // Plain `.vue` and `.ts` files are handled by `vite.resolveId` instead.
    expect(transformInclude(`${layerDir}/components/X.vue`)).toBe(false)
    expect(transformInclude(`${layerDir}/utils.ts`)).toBe(false)

    // Vite emits virtual sub-IDs for `<style>` blocks; those should be transformed.
    expect(transformInclude(`${layerDir}/components/X.vue?vue&type=style&index=0&lang.scss`)).toBe(true)
    expect(transformInclude(`${layerDir}/components/X.vue?vue&type=style&index=0&lang.css`)).toBe(true)

    // Standalone style files in any registered layer are transformed.
    expect(transformInclude(`${layerDir}/styles/global.scss`)).toBe(true)
    expect(transformInclude(`${layerDir}/styles/global.sass`)).toBe(true)
    expect(transformInclude(`${layerDir}/styles/global.less`)).toBe(true)
    expect(transformInclude(`${layerDir}/styles/global.css`)).toBe(true)
    expect(transformInclude(`${otherLayerDir}/styles/global.scss`)).toBe(true)

    // Outside any layer: never transformed.
    expect(transformInclude(`/somewhere/else/global.scss`)).toBe(false)
  })

  it('on non-vite, transforms any file inside a registered layer', () => {
    const { transformInclude } = createPlugin([makeLayer(layerDir)], 'webpack')

    expect(transformInclude(`${layerDir}/components/X.vue`)).toBe(true)
    expect(transformInclude(`${layerDir}/utils.ts`)).toBe(true)
    expect(transformInclude(`${layerDir}/styles/global.scss`)).toBe(true)
    expect(transformInclude(`/somewhere/else/file.ts`)).toBe(false)
  })
})

describe('LayerAliasingPlugin resolveId', () => {
  it('does not resolve aliases for importers in a sibling directory', () => {
    const { resolveId } = createPlugin([makeLayer('/abs/foo')])

    expect(resolveId('~/utils', '/abs/foo-bar/plugins/example.ts')).toBeUndefined()
  })

  it('resolves aliases in the most specific containing layer', () => {
    const { resolveId } = createPlugin([makeLayer('/abs'), makeLayer('/abs/foo')])

    expect(resolveId('~/utils', '/abs/foo/plugins/example.ts')).toEqual({ id: '/abs/foo/utils' })
    expect(resolveId('~/utils', '/abs/foo-bar/plugins/example.ts')).toEqual({ id: '/abs/utils' })
  })
})

describe('LayerAliasingPlugin dependency scan', async () => {
  const rootDir = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-layer-aliasing-')))
  const srcDir = join(rootDir, 'app/')
  const layerRoot = join(rootDir, 'node_modules/installed-layer/')
  const layerSrcDir = join(layerRoot, 'app/')
  const localLayerRoot = join(rootDir, 'layers/local/')
  const composable = join(layerSrcDir, 'composables/useGreeting.ts')
  const sharedCjs = join(layerRoot, 'shared/cjs.ts')
  const localPrefixes = ['@', '~', '@@/app', '~~/app']

  const files: Record<string, string> = {
    [join(rootDir, 'package.json')]: JSON.stringify({ name: 'fixture', type: 'module' }),
    [join(srcDir, 'entry.ts')]: 'import \'../layers/local/app/plugin\'\n',
    [join(layerRoot, 'package.json')]: JSON.stringify({ name: 'installed-layer', type: 'module' }),
    [join(layerSrcDir, 'components/LayerGreeting.vue')]: '<script setup lang="ts">\nimport { useGreeting } from \'@/composables/useGreeting\'\nuseGreeting()\n</script>\n',
    [composable]: 'import { makeGreeting } from \'@/utils/greeting\'\nexport const useGreeting = () => makeGreeting()\n',
    [join(layerSrcDir, 'utils/greeting.ts')]: 'import dep from \'layer-dep\'\nimport { format } from \'~~/shared/format\'\nimport { exclaim } from \'@@/shared/cjs\'\nexport const makeGreeting = () => exclaim(format(dep))\n',
    [join(layerRoot, 'shared/format.ts')]: 'import dep from \'shared-dep\'\nexport const format = (value: unknown) => `${dep}${value}`\n',
    [sharedCjs]: 'import cjs from \'cjs-only\'\nexport const exclaim = (value: string) => cjs(value)\n',
    [join(layerRoot, 'node_modules/cjs-only/package.json')]: JSON.stringify({ name: 'cjs-only', version: '1.0.0', main: 'index.js' }),
    [join(layerRoot, 'node_modules/cjs-only/index.js')]: 'module.exports = value => value + \'!\'\n',
    [join(localLayerRoot, 'app/plugin.ts')]: localPrefixes.map((prefix, i) => `import '${prefix}/utils/local-${i}'\n`).join(''),
  }
  const esmDeps = {
    [join(layerRoot, 'node_modules/layer-dep')]: 'layer-dep',
    [join(layerRoot, 'node_modules/shared-dep')]: 'shared-dep',
  }
  for (const i of localPrefixes.keys()) {
    files[join(localLayerRoot, `app/utils/local-${i}.ts`)] = `import 'local-dep-${i}'\n`
    esmDeps[join(rootDir, 'node_modules', `local-dep-${i}`)] = `local-dep-${i}`
  }
  for (const [dir, name] of Object.entries(esmDeps)) {
    files[join(dir, 'package.json')] = JSON.stringify({ name, version: '1.0.0', type: 'module', main: 'index.mjs' })
    files[join(dir, 'index.mjs')] = 'export default 1\n'
  }
  for (const [file, contents] of Object.entries(files)) {
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, contents)
  }

  afterAll(() => rm(rootDir, { recursive: true, force: true, maxRetries: 5 }))

  const layers = [layerRoot, localLayerRoot].map(cwd => ({ cwd, config: { rootDir: cwd, srcDir: join(cwd, 'app/') } }) as NuxtConfigLayer)

  async function createDevServer (entries: string[]) {
    const server = await createServer({
      root: rootDir,
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true },
      resolve: { alias: { '@@': rootDir, '~~': rootDir, '@': srcDir, '~': srcDir } },
      plugins: [LayerAliasingPlugin({ root: srcDir, dev: true, layers }).vite()],
      environments: {
        client: {
          optimizeDeps: { entries, force: true, holdUntilCrawlEnd: false },
        },
      },
    })
    onTestFinished(() => server.close())
    return server
  }

  async function scan (entries: string[]) {
    const server = await createDevServer(entries)
    const optimizer = server.environments.client.depsOptimizer
    await optimizer?.scanProcessing
    return Object.keys({ ...optimizer?.metadata.optimized, ...optimizer?.metadata.discovered }).toSorted()
  }

  it('does not pre-bundle aliased imports between files of an installed layer', async () => {
    await expect(scan([join(layerSrcDir, '**/*.{vue,ts}')])).resolves.toEqual(['cjs-only', 'layer-dep', 'shared-dep'])
  })

  it('pre-bundles dependencies of installed layer files outside the layer source directory', async () => {
    const server = await createDevServer([join(layerSrcDir, '**/*.{vue,ts}')])
    await server.environments.client.depsOptimizer?.scanProcessing
    const result = await server.environments.client.transformRequest(sharedCjs)

    expect(result?.code).toMatch(/from "\/node_modules\/\.vite\/deps\/cjs-only\.js\?v=\w+"/)
  })

  it('scans local layer files reached through layer aliases', async () => {
    await expect(scan([join(srcDir, 'entry.ts')])).resolves.toEqual(localPrefixes.map((_, i) => `local-dep-${i}`))
  })

  it('serves installed layer files reached through layer aliases from source', async () => {
    const server = await createDevServer([join(layerSrcDir, '**/*.{vue,ts}')])
    await server.environments.client.depsOptimizer?.scanProcessing
    const result = await server.environments.client.transformRequest(composable)

    expect(result?.code).toMatch(/from "\/node_modules\/installed-layer\/app\/utils\/greeting\.ts\?v=\w+"/)
  })
})
