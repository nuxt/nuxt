import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { dirname, join } from 'pathe'
import { build } from 'vite'
import type { PluginOption, Rollup } from 'vite'
import { rolldown } from 'rolldown'
import { resolveVuePackages } from '@nuxt/kit/internal'

import { VuePackagesPlugin } from '../src/core/plugins/vue-packages.ts'

const tmpDir = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-vue-packages-')))

afterAll(() => rm(tmpDir, { recursive: true, force: true }))

async function write (path: string, contents: string) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, contents)
}

async function link (target: string, path: string) {
  await mkdir(dirname(path), { recursive: true })
  await symlink(target, path, 'junction')
}

const DEPENDENCIES: Record<string, string | undefined> = {
  'vue': '@vue/runtime-dom',
  '@vue/runtime-dom': '@vue/runtime-core',
  '@vue/runtime-core': '@vue/reactivity',
  '@vue/reactivity': undefined,
}

async function writeVue (store: string, version: string) {
  for (const [name, dependency] of Object.entries(DEPENDENCIES)) {
    const nodeModules = join(store, `${name.replace('/', '+')}@${version}/node_modules`)
    const dir = join(nodeModules, name)
    await write(join(dir, 'package.json'), JSON.stringify({ name, version, type: 'module', exports: { '.': './index.js', './*': './*' } }))
    await write(join(dir, 'index.js'), dependency
      ? `export * from '${dependency}'\nexport const ${name === 'vue' ? 'version' : 'unused'} = '${version}'\n`
      : `export const reactivity = '${version}'\n`)
    if (dependency) {
      await link(join(store, `${dependency.replace('/', '+')}@${version}/node_modules`, dependency), join(nodeModules, dependency))
    }
  }
  return join(store, `vue@${version}/node_modules/vue`)
}

async function createProject ({ appVue }: { appVue?: string } = {}) {
  const rootDir = join(tmpDir, appVue ? 'project-with-vue' : 'project')
  const store = join(rootDir, 'node_modules/.pnpm')
  const nuxtDir = join(store, 'nuxt@1.0.0/node_modules/nuxt')
  const uiDir = join(store, 'ui@1.0.0/node_modules/ui')

  await write(join(rootDir, 'package.json'), JSON.stringify({ name: 'project', type: 'module' }))
  await write(join(rootDir, 'entry.js'), [
    'export { version as app } from \'vue\'',
    'export { version as nuxt } from \'nuxt\'',
    'export { version as ui, reactivity as uiReactivity } from \'ui\'',
  ].join('\n'))

  await link(await writeVue(store, '1.0.0'), join(store, 'nuxt@1.0.0/node_modules/vue'))
  await write(join(nuxtDir, 'package.json'), JSON.stringify({ name: 'nuxt', type: 'module', exports: './dist/index.js' }))
  await write(join(nuxtDir, 'dist/index.js'), 'export { version } from \'vue\'\n')
  await mkdir(join(nuxtDir, 'dist/app'), { recursive: true })
  await link(nuxtDir, join(rootDir, 'node_modules/nuxt'))

  // pnpm hoists a second copy that a package without its own dependency on vue resolves
  await writeVue(store, '2.0.0')
  await link(join(store, 'vue@2.0.0/node_modules/vue'), join(store, 'node_modules/vue'))
  await link(join(store, '@vue+reactivity@2.0.0/node_modules/@vue/reactivity'), join(store, 'node_modules/@vue/reactivity'))

  if (appVue) {
    await link(await writeVue(store, appVue), join(rootDir, 'node_modules/vue'))
  }

  await write(join(uiDir, 'package.json'), JSON.stringify({ name: 'ui', type: 'module', exports: './index.js' }))
  await write(join(uiDir, 'index.js'), 'export { version } from \'vue\'\nexport { reactivity } from \'@vue/reactivity\'\n')
  await link(uiDir, join(rootDir, 'node_modules/ui'))

  const nuxt = {
    options: {
      rootDir,
      appDir: join(nuxtDir, 'dist/app'),
    },
  } as unknown as Parameters<typeof resolveVuePackages>[0]
  return { rootDir, packages: resolveVuePackages(nuxt) }
}

const buildProject = (rootDir: string, dir: string, plugins: PluginOption[]) => build({
  root: rootDir,
  configFile: false,
  logLevel: 'silent',
  resolve: { dedupe: ['vue'] },
  plugins,
  build: {
    outDir: join(rootDir, dir),
    minify: false,
    lib: { entry: join(rootDir, 'entry.js'), formats: ['es'], fileName: () => 'entry.js' },
  },
})

describe('VuePackagesPlugin', async () => {
  const { rootDir, packages } = await createProject()

  it('resolves vue and its dependencies along the dependency chain', () => {
    expect(packages.version).toBe('1.0.0')
    expect(Object.fromEntries(Object.entries(packages.dirs).map(([name, dir]) => [name, dir.slice(rootDir.length)]))).toStrictEqual({
      'vue': '/node_modules/.pnpm/vue@1.0.0/node_modules/vue',
      '@vue/runtime-dom': '/node_modules/.pnpm/@vue+runtime-dom@1.0.0/node_modules/@vue/runtime-dom',
      '@vue/runtime-core': '/node_modules/.pnpm/@vue+runtime-core@1.0.0/node_modules/@vue/runtime-core',
      '@vue/reactivity': '/node_modules/.pnpm/@vue+reactivity@1.0.0/node_modules/@vue/reactivity',
    })
  })

  it('bundles a single copy of vue for the client', async () => {
    await buildProject(rootDir, 'dist', [VuePackagesPlugin(packages)])
    await expect(import(pathToFileURL(join(rootDir, 'dist/entry.js')).href)).resolves.toMatchObject({ app: '1.0.0', nuxt: '1.0.0', ui: '1.0.0', uiReactivity: '1.0.0' })
  })

  it.each([false, true])('resolves `vue` from the pinned copy once per import or once per build (cache: %s)', async (cache) => {
    const pinned: string[] = []
    await buildProject(rootDir, `dist-${cache}`, [
      VuePackagesPlugin(packages, { cache }),
      { name: 'count', enforce: 'pre', resolveId: (id, importer) => { if (importer?.endsWith('package.json')) { pinned.push(id) } } },
    ])
    await expect(import(pathToFileURL(join(rootDir, `dist-${cache}/entry.js`)).href)).resolves.toMatchObject({ app: '1.0.0', nuxt: '1.0.0', ui: '1.0.0', uiReactivity: '1.0.0' })
    expect(pinned.filter(id => id === 'vue')).toHaveLength(cache ? 1 : 3)
  })

  it('does not reuse cached resolutions in a later build', async () => {
    const plugin = VuePackagesPlugin(packages, { cache: true })
    const externalVue = { name: 'external-vue', resolveId: (id: string, importer?: string) => id === 'vue' && importer?.endsWith('package.json') ? { id: 'vue', external: true } : undefined }
    const imports: string[][] = []
    for (const plugins of [[plugin, externalVue], [plugin]]) {
      const bundle = await rolldown({ input: join(rootDir, 'entry.js'), platform: 'node', logLevel: 'silent', plugins })
      const { output } = await bundle.generate({ format: 'es' })
      await bundle.close()
      imports.push(output[0].imports)
    }
    expect(imports).toStrictEqual([['vue'], []])
  })

  it('caches `import` and `require` resolutions separately', async () => {
    const plugin = VuePackagesPlugin(packages, { cache: true })
    const handler = (plugin.resolveId as { handler: (this: unknown, ...args: unknown[]) => Promise<Rollup.ResolvedId | null> }).handler
    const requests: boolean[] = []
    const context = {
      resolve: (id: string, _importer: string, options: { custom?: { 'node-resolve'?: { isRequire?: boolean } } }) => {
        const isRequire = !!options.custom?.['node-resolve']?.isRequire
        requests.push(isRequire)
        return Promise.resolve({ id: `${id}.${isRequire ? 'cjs' : 'mjs'}`, external: false })
      },
    }
    const importer = join(rootDir, 'entry.js')
    const resolve = (isRequire: boolean) => handler.call(context, 'vue', importer, { isEntry: false, custom: { 'node-resolve': { isRequire } } })
    await expect(resolve(false)).resolves.toMatchObject({ id: 'vue.mjs' })
    await expect(resolve(true)).resolves.toMatchObject({ id: 'vue.cjs' })
    await expect(resolve(false)).resolves.toMatchObject({ id: 'vue.mjs' })
    await expect(resolve(true)).resolves.toMatchObject({ id: 'vue.cjs' })
    expect(requests).toStrictEqual([false, true])
  })

  describe('when the project depends on vue', async () => {
    const { rootDir, packages } = await createProject({ appVue: '3.0.0' })

    it('resolves the project\'s copy of vue and its dependencies', () => {
      expect(packages.version).toBe('3.0.0')
      expect(Object.fromEntries(Object.entries(packages.dirs).map(([name, dir]) => [name, dir.slice(rootDir.length)]))).toStrictEqual({
        'vue': '/node_modules/.pnpm/vue@3.0.0/node_modules/vue',
        '@vue/runtime-dom': '/node_modules/.pnpm/@vue+runtime-dom@3.0.0/node_modules/@vue/runtime-dom',
        '@vue/runtime-core': '/node_modules/.pnpm/@vue+runtime-core@3.0.0/node_modules/@vue/runtime-core',
        '@vue/reactivity': '/node_modules/.pnpm/@vue+reactivity@3.0.0/node_modules/@vue/reactivity',
      })
    })

    it('bundles that copy rather than the one nuxt depends on', async () => {
      await buildProject(rootDir, 'dist', [VuePackagesPlugin(packages)])
      await expect(import(pathToFileURL(join(rootDir, 'dist/entry.js')).href)).resolves.toMatchObject({ app: '3.0.0', nuxt: '3.0.0', ui: '3.0.0', uiReactivity: '3.0.0' })
    })
  })
})
