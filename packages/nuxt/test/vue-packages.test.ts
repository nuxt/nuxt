import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { dirname, join } from 'pathe'
import { build } from 'vite'
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
  await symlink(target, path, 'dir')
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

async function createProject () {
  const rootDir = join(tmpDir, 'project')
  const store = join(rootDir, 'node_modules/.pnpm')
  const nuxtDir = join(store, 'nuxt@1.0.0/node_modules/nuxt')
  const uiDir = join(store, 'ui@1.0.0/node_modules/ui')

  await write(join(rootDir, 'package.json'), JSON.stringify({ name: 'project', type: 'module' }))
  await write(join(rootDir, 'entry.js'), [
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
  await write(join(uiDir, 'package.json'), JSON.stringify({ name: 'ui', type: 'module', exports: './index.js' }))
  await write(join(uiDir, 'index.js'), 'export { version } from \'vue\'\nexport { reactivity } from \'@vue/reactivity\'\n')
  await link(uiDir, join(rootDir, 'node_modules/ui'))

  const nuxt = { options: { appDir: join(nuxtDir, 'dist/app') } } as Parameters<typeof resolveVuePackages>[0]
  return { rootDir, packages: resolveVuePackages(nuxt) }
}

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
    const dir = join(rootDir, 'dist')
    await build({
      root: rootDir,
      configFile: false,
      logLevel: 'silent',
      plugins: [VuePackagesPlugin(packages)],
      build: {
        outDir: dir,
        minify: false,
        lib: { entry: join(rootDir, 'entry.js'), formats: ['es'], fileName: () => 'entry.js' },
      },
    })
    await expect(import(pathToFileURL(join(dir, 'entry.js')).href)).resolves.toMatchObject({ nuxt: '1.0.0', ui: '1.0.0', uiReactivity: '1.0.0' })
  })
})
