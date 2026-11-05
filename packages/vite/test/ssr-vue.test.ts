import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { runWithNuxtContext } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import { resolveModulePath } from 'exsolve'
import { dirname, join } from 'pathe'
import { build } from 'vite'
import { exec } from 'tinyexec'

import { ResolveExternalsPlugin } from '../src/plugins/resolved-externals.ts'
import { ssr, ssrEnvironment } from '../src/shared/server.ts'
import { BundledVuePlugin } from '../../nuxt/src/core/plugins/bundled-vue.ts'

const tmpDir = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-ssr-vue-')))

afterAll(() => rm(tmpDir, { recursive: true, force: true }))

// https://github.com/nuxt/nuxt/issues/36776
describe('SSR Vue dependencies', () => {
  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])('preserves Vue reactivity across server builds (direct Vue dependency: %s, runtime compiler: %s)', async (rootVue, runtimeCompiler) => {
    const rootDir = join(tmpDir, `project-${rootVue}-${runtimeCompiler}`)
    const vue = resolveModulePath('vue', { from: import.meta.url })
    const runtimeCore = resolveModulePath('@vue/runtime-core', { from: vue })
    const reactivity = resolveModulePath('@vue/reactivity/package.json', { from: runtimeCore })
    await mkdir(join(rootDir, 'node_modules/@vue'), { recursive: true })
    await symlink(dirname(reactivity), join(rootDir, 'node_modules/@vue/reactivity'), 'dir')
    if (rootVue) {
      await symlink(dirname(resolveModulePath('vue/package.json', { from: import.meta.url })), join(rootDir, 'node_modules/vue'), 'dir')
      await mkdir(join(rootDir, 'node_modules/vue-consumer'), { recursive: true })
      await writeFile(join(rootDir, 'node_modules/vue-consumer/package.json'), JSON.stringify({
        name: 'vue-consumer', version: '1.0.0', main: 'index.cjs', peerDependencies: { vue: '*' },
      }))
      await writeFile(join(rootDir, 'node_modules/vue-consumer/index.cjs'), `
        const { effect } = require('vue')
        exports.observe = (state, callback) => effect(() => callback(state.count))
      `)
    }
    await writeFile(join(rootDir, 'package.json'), JSON.stringify({
      type: 'module', dependencies: { '@vue/reactivity': '*', ...rootVue ? { 'vue': '*', 'vue-consumer': '1.0.0' } : {} },
    }))
    await writeFile(join(rootDir, 'entry.js'), [
      `export { reactive, effect } from ${JSON.stringify(rootVue ? 'vue' : vue)}`,
      `export { reactive as directReactive } from '@vue/reactivity'`,
      `export const loadReactivity = () => import('./lazy.js')`,
      ...rootVue ? [`export { observe } from 'vue-consumer'`] : [],
      ...runtimeCompiler ? [`export { compile } from ${JSON.stringify(rootVue ? 'vue' : vue)}`] : [],
    ].join('\n'))
    await writeFile(join(rootDir, 'lazy.js'), `import { reactive } from '@vue/reactivity'; export const getReactive = () => reactive`)

    const nuxt = {
      'options': {
        dev: false,
        rootDir,
        buildDir: join(rootDir, '.nuxt'),
        extensions: ['.js', '.mjs'],
        build: { transpile: [] },
        dir: { shared: 'shared' },
        sourcemap: { server: false },
        vite: { mode: 'production' },
      },
      '~runtimeDependencies': [],
    } as unknown as Nuxt
    const outDir = join(tmpDir, `output-${rootVue}-${runtimeCompiler}`)
    const server = runWithNuxtContext(nuxt, () => ssrEnvironment(nuxt, join(rootDir, 'entry.js')))
    const define = {
      'process.env.NODE_ENV': '"production"',
      '__VUE_OPTIONS_API__': 'true',
      '__VUE_PROD_DEVTOOLS__': 'false',
      '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false',
    }
    await build({
      root: rootDir,
      configFile: false,
      logLevel: 'silent',
      ssr: {
        ...runWithNuxtContext(nuxt, () => ssr(nuxt)),
        resolve: { conditions: ['module', 'node', 'production'] },
      },
      resolve: { dedupe: ['vue'] },
      plugins: [ResolveExternalsPlugin(nuxt), ...runtimeCompiler ? [] : [BundledVuePlugin()]],
      define,
      build: { ...server.build, minify: false },
    })

    const serverEntry = join(server.build.outDir, 'server.mjs')
    if (rootVue) {
      expect(await readFile(serverEntry, 'utf8')).toContain('from "vue-consumer"')
    }

    // The server builder consumes Vite's intermediate output in a second pass.
    await build({
      root: rootDir,
      configFile: false,
      logLevel: 'silent',
      ssr: { noExternal: true, resolve: { conditions: ['module', 'node', 'production'] } },
      plugins: runtimeCompiler ? [] : [BundledVuePlugin()],
      define,
      build: {
        ssr: serverEntry,
        outDir,
        minify: false,
        rolldownOptions: { output: { entryFileNames: 'entry.mjs' } },
      },
    })

    const dependenciesDir = vue.slice(0, vue.indexOf('/node_modules/') + '/node_modules/'.length)
    for (const file of await readdir(outDir, { recursive: true })) {
      if (!/\.[cm]?js$/.test(file)) { continue }
      const code = await readFile(join(outDir, file), 'utf8')
      for (const path of [dependenciesDir, rootDir]) {
        for (const quote of ['"', '\'']) {
          expect(code.includes(quote + path), `${file} references ${path}`).toBe(false)
        }
      }
    }
    await rm(rootDir, { recursive: true, force: true })
    const result = await exec(process.execPath, ['--input-type=module', '-e', `
      import * as vue from ${JSON.stringify(pathToFileURL(join(outDir, 'entry.mjs')).href)}
      const { reactive, directReactive, effect } = vue
      const state = directReactive({ count: 0 })
      let count = -1
      let externalCount = null
      effect(() => { count = state.count })
      if (${rootVue}) vue.observe(state, value => { externalCount = value })
      state.count++
      const { getReactive } = await vue.loadReactivity()
      const rendered = ${runtimeCompiler} ? vue.compile('<div>{{ count }}</div>')(state, []).children : null
      console.log(JSON.stringify({ same: reactive === directReactive && reactive === getReactive(), count, externalCount, rendered }))
    `], { throwOnError: true })
    expect(JSON.parse(result.stdout)).toEqual({ same: true, count: 1, externalCount: rootVue ? 1 : null, rendered: runtimeCompiler ? '1' : null })
  })
})
