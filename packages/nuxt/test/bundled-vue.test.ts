import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { dirname, join } from 'pathe'
import { rolldown } from 'rolldown'
import type { Plugin } from 'rolldown'

import { BundledVuePlugin } from '../src/core/plugins/bundled-vue.ts'

const tmpDir = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-bundled-vue-')))

afterAll(() => rm(tmpDir, { recursive: true, force: true }))

async function write (path: string, contents: string) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, contents)
}

async function link (target: string, path: string) {
  await mkdir(dirname(path), { recursive: true })
  await symlink(target, path, 'dir')
}

async function writeVuePackage (dir: string, name: string) {
  await write(join(dir, 'package.json'), JSON.stringify({
    name: `@vue/${name}`,
    exports: { '.': { node: './index.js', import: `./dist/${name}.esm-bundler.js`, require: './index.js' }, './*': './*' },
  }))
  await write(join(dir, 'index.js'), 'exports.state = { build: \'cjs\' }\n')
  await write(join(dir, `dist/${name}.esm-bundler.js`), 'export const state = { build: \'esm-bundler\' }\n')
}

async function createProject () {
  const rootDir = join(tmpDir, 'project')
  const store = join(rootDir, 'node_modules/.pnpm')
  const vueDir = join(store, 'vue@1.0.0/node_modules/vue')
  const runtimeDomDir = join(store, '@vue+runtime-dom@1.0.0/node_modules/@vue/runtime-dom')
  const serverRendererDir = join(store, '@vue+server-renderer@1.0.0/node_modules/@vue/server-renderer')

  await write(join(rootDir, 'package.json'), JSON.stringify({ name: 'project', type: 'module' }))
  await write(join(rootDir, 'entry.js'), [
    'import { build, state } from \'vue\'',
    'import { state as renderer } from \'vue/server-renderer\'',
    `import { state as direct } from ${JSON.stringify(join(runtimeDomDir, 'index.js'))}`,
    'export const vue = build',
    'export const serverRenderer = renderer.build',
    'export const shared = state === direct',
  ].join('\n'))

  await write(join(vueDir, 'package.json'), JSON.stringify({
    name: 'vue',
    exports: {
      '.': { import: { node: './index.mjs', default: './dist/vue.runtime.esm-bundler.js' }, require: './index.js' },
      './server-renderer': { import: './server-renderer/index.mjs', require: './server-renderer/index.js' },
      './dist/*': './dist/*',
    },
  }))
  await write(join(vueDir, 'index.mjs'), 'export * from \'./index.js\'\n')
  await write(join(vueDir, 'index.js'), 'exports.build = \'cjs\'\nexports.state = require(\'@vue/runtime-dom\').state\n')
  await write(join(vueDir, 'dist/vue.runtime.esm-bundler.js'), 'export const build = \'esm-bundler\'\nexport { state } from \'@vue/runtime-dom\'\n')
  await write(join(vueDir, 'server-renderer/index.mjs'), 'export * from \'@vue/server-renderer\'\n')
  await write(join(vueDir, 'server-renderer/index.js'), 'module.exports = require(\'@vue/server-renderer\')\n')

  await writeVuePackage(runtimeDomDir, 'runtime-dom')
  await writeVuePackage(serverRendererDir, 'server-renderer')

  await link(vueDir, join(rootDir, 'node_modules/vue'))
  await link(runtimeDomDir, join(store, 'vue@1.0.0/node_modules/@vue/runtime-dom'))
  await link(serverRendererDir, join(store, 'vue@1.0.0/node_modules/@vue/server-renderer'))

  return rootDir
}

async function buildEntry (rootDir: string, options: { external?: boolean } = {}) {
  const dir = join(rootDir, `dist-${Math.random().toString(36).slice(2)}`)
  const absoluteExternal: Plugin = {
    name: 'absolute-external',
    resolveId: id => id === 'vue' ? { id: join(rootDir, 'node_modules/vue/index.mjs'), external: 'absolute' } : undefined,
  }
  const bundle = await rolldown({
    input: join(rootDir, 'entry.js'),
    platform: 'node',
    logLevel: 'silent',
    resolve: { conditionNames: ['node', 'import', 'default'] },
    external: options.external ? ['vue/server-renderer'] : [],
    plugins: [BundledVuePlugin(), ...options.external ? [absoluteExternal] : []],
  })
  await bundle.write({ dir, format: 'esm', entryFileNames: 'entry.js' })
  await bundle.close()
  return { ...await import(pathToFileURL(join(dir, 'entry.js')).href) }
}

describe('BundledVuePlugin', async () => {
  const rootDir = await createProject()

  it('bundles a single esm-bundler build of each vue package', async () => {
    await expect(buildEntry(rootDir)).resolves.toStrictEqual({ vue: 'esm-bundler', serverRenderer: 'esm-bundler', shared: true })
  })

  it('leaves vue external when the bundle externalises it', async () => {
    await expect(buildEntry(rootDir, { external: true })).resolves.toMatchObject({ vue: 'cjs', serverRenderer: 'cjs' })
  })
})
