import { createHash } from 'node:crypto'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { VueLoaderPlugin, getVueLoaderHash, vueLoader, webpack } from '../builder.mjs'

const require = createRequire(new URL('../builder.mjs', import.meta.url))
const rootNodeModules = resolve(import.meta.dirname, '../../../node_modules')

describe('rspack-vue-loader', () => {
  it('compiles scoped Vue components with the Rspack loader', async () => {
    const source = `<template><h1 class="title">Hello</h1></template>
<style scoped>.title { color: red; }</style>
`
    const expectedHash = createHash('sha256').update(`App.vue\n${source}`).digest('hex').substring(0, 8)
    let temporaryDirectory: string | undefined
    let closeCompiler: (() => Promise<void>) | undefined

    try {
      temporaryDirectory = await mkdtemp(join(tmpdir(), 'nuxt-rspack-vue-loader-'))
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
        module: {
          rules: [
            { test: /\.vue$/, loader: vueLoader },
            { resourceQuery: /type=style/, type: 'asset/source' },
          ],
        },
        plugins: [new VueLoaderPlugin()],
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
          if (!stats) { return reject(new Error('Rspack did not return compilation stats.')) }
          resolve(stats)
        })
      })

      expect(stats.toJson({ all: false, errors: true }).errors).toEqual([])
      expect(vueLoader).toBe(require.resolve('rspack-vue-loader'))
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
