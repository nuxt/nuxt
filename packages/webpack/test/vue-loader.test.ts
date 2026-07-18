import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { VueLoaderPlugin, getVueLoaderHash, vueLoader, webpack } from '../builder.mjs'

const require = createRequire(new URL('../builder.mjs', import.meta.url))
const hashSum = require('hash-sum') as (value: string) => string

const rootNodeModules = resolve(import.meta.dirname, '../../../node_modules')

describe('vue-loader', () => {
  it('compiles scoped Vue components with the Webpack loader', async () => {
    const source = `<template><h1 class="title">Hello</h1></template>
<style scoped>.title { color: red; }</style>
`
    const expectedHash = hashSum(`App.vue\n${source}`)
    let temporaryDirectory: string | undefined
    let closeCompiler: (() => Promise<void>) | undefined

    try {
      temporaryDirectory = await mkdtemp(join(tmpdir(), 'nuxt-webpack-vue-loader-'))
      const context = await realpath(temporaryDirectory)
      const outputPath = join(context, 'dist')

      await writeFile(join(context, 'App.vue'), source)

      const compiler = webpack({
        mode: 'production',
        context,
        entry: './App.vue',
        output: {
          path: outputPath,
          filename: 'bundle.js',
        },
        resolve: {
          modules: [rootNodeModules, 'node_modules'],
        },
        resolveLoader: {
          modules: [rootNodeModules, 'node_modules'],
        },
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
      closeCompiler = () => new Promise<void>((resolve, reject) => {
        compiler.close(error => error ? reject(error) : resolve())
      })

      type Stats = NonNullable<Parameters<Parameters<typeof compiler.run>[0]>[1]>
      const stats = await new Promise<Stats>((resolve, reject) => {
        compiler.run((error, stats) => {
          if (error) { return reject(error) }
          if (!stats) { return reject(new Error('Webpack did not return compilation stats.')) }
          resolve(stats)
        })
      })

      expect(stats.toJson({ all: false, errors: true }).errors).toEqual([])
      expect(vueLoader).toBe('vue-loader')
      expect(require.resolve(vueLoader)).toBe(require.resolve('vue-loader'))
      expect(getVueLoaderHash(`App.vue\n${source}`)).toBe(expectedHash)
      await expect(readFile(join(outputPath, 'bundle.js'), 'utf8')).resolves.toContain(`data-v-${expectedHash}`)
    } finally {
      try {
        await closeCompiler?.()
      } finally {
        if (temporaryDirectory) {
          await rm(temporaryDirectory, { recursive: true, force: true })
        }
      }
    }
  })
})
