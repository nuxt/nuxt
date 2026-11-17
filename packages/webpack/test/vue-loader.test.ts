import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { impl as webpackImpl } from '../src/impl.ts'
import { impl as rspackImpl } from '../../rspack/src/impl.ts'

const rootNodeModules = resolve(import.meta.dirname, '../../../node_modules')

describe('vue-loader', () => {
  it.each([webpackImpl, rspackImpl])('compiles scoped Vue components with the $builder loader', async ({ VueLoaderPlugin, getVueLoaderHash, vueLoader, webpack }) => {
    const source = `<template><h1 class="title">Hello</h1></template>
<style scoped>.title { color: red; }</style>
`
    const context = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-vue-loader-')))
    const outputPath = join(context, 'dist')
    await writeFile(join(context, 'App.vue'), source)

    const compiler = webpack({
      mode: 'production',
      context,
      entry: './App.vue',
      output: { path: outputPath, filename: 'bundle.js' },
      resolve: { modules: [rootNodeModules, 'node_modules'] },
      resolveLoader: { modules: [rootNodeModules, 'node_modules'] },
      module: {
        rules: [
          { test: /\.vue$/, loader: vueLoader },
          { resourceQuery: /type=style/, type: 'asset/source' },
        ],
      },
      plugins: [
        // @ts-expect-error de-default vue-loader
        new (VueLoaderPlugin.default || VueLoaderPlugin)(),
      ],
      optimization: { minimize: false },
      performance: false,
    })

    try {
      const stats = await new Promise<NonNullable<Parameters<Parameters<typeof compiler.run>[0]>[1]>>((resolve, reject) => {
        compiler.run((error, stats) => error || !stats ? reject(error) : resolve(stats))
      })
      expect(stats.toJson({ all: false, errors: true }).errors).toEqual([])
      await expect(readFile(join(outputPath, 'bundle.js'), 'utf8')).resolves.toContain(`data-v-${getVueLoaderHash(`App.vue\n${source}`)}`)
    } finally {
      await new Promise(resolve => compiler.close(resolve))
      await rm(context, { recursive: true, force: true })
    }
  })
})
