import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { afterAll, describe, expect, it } from 'vitest'
import { dirname, join } from 'pathe'
import { createServer, createServerModuleRunner } from 'vite'

import { InlinedVuePlugin } from '../src/plugins/inlined-vue.ts'

const tmpDir = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-inlined-vue-')))

afterAll(() => rm(tmpDir, { recursive: true, force: true }))

async function write (path: string, contents: string) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, contents)
}

async function link (target: string, path: string) {
  await mkdir(dirname(path), { recursive: true })
  await symlink(target, path, 'dir')
}

async function writeVue (dir: string, version: string) {
  await write(join(dir, 'package.json'), JSON.stringify({
    name: 'vue',
    version,
    exports: { '.': { import: { node: './index.mjs', default: './dist/vue.runtime.esm-bundler.js' }, require: './index.js' }, './dist/*': './dist/*' },
  }))
  await write(join(dir, 'index.mjs'), 'export * from \'./index.js\'\n')
  await write(join(dir, 'index.js'), `exports.build = 'cjs'\nexports.version = '${version}'\n`)
  await write(join(dir, 'dist/vue.runtime.esm-bundler.js'), `export const build = 'runtime'\nexport const version = '${version}'\n`)
  await write(join(dir, 'dist/vue.esm-bundler.js'), `export const build = 'full'\nexport const version = '${version}'\n`)
}

async function createPnpmProject (name: string, options: { rootVue?: boolean } = {}) {
  const rootDir = join(tmpDir, name)
  const store = join(rootDir, 'node_modules/.pnpm')
  const nuxtDir = join(store, 'nuxt@1.0.0/node_modules/nuxt')
  await write(join(rootDir, 'package.json'), JSON.stringify({ name, type: 'module' }))
  await writeVue(join(store, 'vue@1.0.0/node_modules/vue'), '1.0.0')
  await write(join(nuxtDir, 'package.json'), JSON.stringify({ name: 'nuxt', version: '1.0.0', type: 'module', exports: './entry.mjs' }))
  await write(join(nuxtDir, 'entry.mjs'), 'export { build, version } from \'vue\'\n')
  await link(join(store, 'vue@1.0.0/node_modules/vue'), join(store, 'nuxt@1.0.0/node_modules/vue'))
  if (options.rootVue) {
    await writeVue(join(store, 'vue@2.0.0/node_modules/vue'), '2.0.0')
    await link(join(store, 'vue@2.0.0/node_modules/vue'), join(rootDir, 'node_modules/vue'))
  }
  return { rootDir, entry: join(nuxtDir, 'entry.mjs') }
}

async function importEntry (project: { rootDir: string, entry: string }, vue: { runtimeCompiler?: boolean } = {}) {
  const nuxt = { options: { vue: { runtimeCompiler: false, ...vue } } } as any
  const server = await createServer({
    root: project.rootDir,
    configFile: false,
    logLevel: 'silent',
    resolve: { dedupe: ['vue'] },
    plugins: [InlinedVuePlugin(nuxt)],
    server: { middlewareMode: true, ws: false, watch: null },
  })
  const runner = createServerModuleRunner(server.environments.ssr, { hmr: false })
  try {
    return { ...await runner.import(project.entry) }
  } finally {
    await runner.close()
    await server.close()
  }
}

describe('InlinedVuePlugin', async () => {
  const isolated = await createPnpmProject('isolated')
  const hoisted = await createPnpmProject('hoisted', { rootVue: true })

  it('inlines the bundler build of a vue that does not resolve from the root', async () => {
    await expect(importEntry(isolated)).resolves.toStrictEqual({ build: 'runtime', version: '1.0.0' })
  })

  it('inlines the full bundler build with the runtime compiler', async () => {
    await expect(importEntry(isolated, { runtimeCompiler: true })).resolves.toStrictEqual({ build: 'full', version: '1.0.0' })
  })

  it('leaves vue external when it resolves from the root', async () => {
    await expect(importEntry(hoisted)).resolves.toStrictEqual({ build: 'cjs', version: '2.0.0' })
  })
})
