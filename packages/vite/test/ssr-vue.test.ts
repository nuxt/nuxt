import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
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
import { ssr } from '../src/shared/server.ts'
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
  ])('bundles reactivity with Vue (direct Vue dependency: %s, runtime compiler: %s)', async (rootVue, runtimeCompiler) => {
    const rootDir = join(tmpDir, `project-${rootVue}-${runtimeCompiler}`)
    const vue = resolveModulePath('vue', { from: import.meta.url })
    const runtimeCore = resolveModulePath('@vue/runtime-core', { from: vue })
    const reactivity = resolveModulePath('@vue/reactivity/package.json', { from: runtimeCore })
    await mkdir(join(rootDir, 'node_modules/@vue'), { recursive: true })
    await symlink(dirname(reactivity), join(rootDir, 'node_modules/@vue/reactivity'), 'dir')
    if (rootVue) {
      await symlink(dirname(resolveModulePath('vue/package.json', { from: import.meta.url })), join(rootDir, 'node_modules/vue'), 'dir')
    }
    await writeFile(join(rootDir, 'package.json'), JSON.stringify({ type: 'module', dependencies: { '@vue/reactivity': '*' } }))
    await writeFile(join(rootDir, 'entry.js'), [
      `export { reactive, effect } from ${JSON.stringify(rootVue ? 'vue' : vue)}`,
      `export { reactive as directReactive } from '@vue/reactivity'`,
      ...runtimeCompiler ? [`export { compile } from ${JSON.stringify(rootVue ? 'vue' : vue)}`] : [],
    ].join('\n'))

    const nuxt = {
      'options': {
        dev: false,
        rootDir,
        buildDir: join(rootDir, '.nuxt'),
        extensions: ['.js', '.mjs'],
        build: { transpile: [] },
      },
      '~runtimeDependencies': [],
    } as unknown as Nuxt
    const outDir = join(tmpDir, `output-${rootVue}-${runtimeCompiler}`)
    await build({
      root: rootDir,
      configFile: false,
      logLevel: 'silent',
      ssr: runWithNuxtContext(nuxt, () => ssr(nuxt)),
      resolve: { dedupe: ['vue'] },
      plugins: [ResolveExternalsPlugin(nuxt), ...runtimeCompiler ? [] : [BundledVuePlugin()]],
      define: {
        'process.env.NODE_ENV': '"production"',
        '__VUE_OPTIONS_API__': 'true',
        '__VUE_PROD_DEVTOOLS__': 'false',
        '__VUE_PROD_HYDRATION_MISMATCH_DETAILS__': 'false',
      },
      build: {
        ssr: join(rootDir, 'entry.js'),
        outDir,
        minify: false,
        rolldownOptions: { output: { entryFileNames: 'entry.mjs' } },
      },
    })

    const code = await readFile(join(outDir, 'entry.mjs'), 'utf8')
    expect(code).not.toContain(dirname(reactivity))
    await rm(rootDir, { recursive: true, force: true })
    const result = await exec(process.execPath, ['--input-type=module', '-e', `
      import * as vue from ${JSON.stringify(pathToFileURL(join(outDir, 'entry.mjs')).href)}
      const { reactive, directReactive, effect } = vue
      const state = directReactive({ count: 0 })
      let count = -1
      effect(() => { count = state.count })
      state.count++
      const rendered = ${runtimeCompiler} ? vue.compile('<div>{{ count }}</div>')(state, []).children : null
      console.log(JSON.stringify({ same: reactive === directReactive, count, rendered }))
    `], { throwOnError: true })
    expect(JSON.parse(result.stdout)).toEqual({ same: true, count: 1, rendered: runtimeCompiler ? '1' : null })
  })
})
