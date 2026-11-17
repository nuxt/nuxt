import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { join } from 'pathe'
import '../src/impl.ts'
import { serverStandalone } from '../src/configs/server.ts'
import type { WebpackConfigContext } from '../src/utils/config.ts'

function writePackage (dir: string, name: string) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, exports: { '.': './index.mjs' } }))
  writeFileSync(join(dir, 'index.mjs'), '')
}

describe('server externals', () => {
  let rootDir: string

  beforeAll(() => {
    rootDir = realpathSync(mkdtempSync(join(tmpdir(), 'nuxt-webpack-externals-')))
    writePackage(join(rootDir, 'node_modules/vue'), 'vue')
    writePackage(join(rootDir, 'node_modules/@vue/compat'), '@vue/compat')
    writeFileSync(join(rootDir, 'paths.mjs'), '')
  })

  afterAll(() => {
    rmSync(rootDir, { force: true, recursive: true })
  })

  function externalFor (alias: Record<string, string>) {
    const options = {
      dev: false,
      rootDir,
      alias,
      dir: { shared: 'shared' },
      modulesDir: [join(rootDir, 'node_modules')],
      build: { transpile: [] },
    }
    const nuxt = { options, ['~runtimeDependencies']: [] }
    const ctx = { nuxt, options, config: { externals: [] } } as unknown as WebpackConfigContext
    serverStandalone(ctx)
    const external = (ctx.config.externals as Array<(data: { request: string, context: string }, cb: (err: unknown, result: unknown) => void) => void>)[0]!
    return (request: string) => new Promise(resolve => external({ request, context: rootDir }, (_err, result) => resolve(result)))
  }

  it('externalises vue by its resolved path', async () => {
    await expect(externalFor({})('vue')).resolves.toBe(join(rootDir, 'node_modules/vue/index.mjs'))
  })

  it('resolves aliases for vue before externalising it', async () => {
    const external = externalFor({ 'vue': '@vue/compat', '#internal/nuxt/paths': join(rootDir, 'paths.mjs') })
    await expect(external('vue')).resolves.toBe(join(rootDir, 'node_modules/@vue/compat/index.mjs'))
    await expect(external('#internal/nuxt/paths')).resolves.toBe(true)
  })
})
