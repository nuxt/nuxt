import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import type { Nuxt } from '@nuxt/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolve } from 'pathe'
import { createServerExternals } from '../src/utils/server-externals.ts'

describe('createServerExternals', () => {
  let root: string
  let entry: string

  beforeAll(() => {
    root = realpathSync(mkdtempSync(resolve(tmpdir(), 'nuxt-webpack-externals-')))
    const pkg = resolve(root, 'node_modules/runtime-dep')
    mkdirSync(pkg, { recursive: true })
    writeFileSync(resolve(pkg, 'package.json'), JSON.stringify({ name: 'runtime-dep', exports: { '.': './index.mjs' } }))
    entry = resolve(pkg, 'index.mjs')
    writeFileSync(entry, 'export default 1')
  })

  afterAll(() => {
    rmSync(root, { force: true, recursive: true })
  })

  function createNuxt (dev: boolean) {
    return {
      'options': {
        dev,
        rootDir: root,
        modulesDir: [resolve(root, 'node_modules')],
        alias: {},
        build: { transpile: [] },
        dir: { shared: 'shared' },
      },
      '~runtimeDependencies': ['runtime-dep'],
    } as unknown as Nuxt
  }

  function externalise (externals: ReturnType<typeof createServerExternals>, request: string) {
    return new Promise<string | boolean | undefined>((resolve, reject) => {
      externals({ request, context: root }, (error, result) => error ? reject(error) : resolve(result))
    })
  }

  it('keeps runtime dependencies as absolute paths by default', async () => {
    const externals = createServerExternals(createNuxt(false))
    expect(await externalise(externals, 'runtime-dep')).toBe(entry)
  })

  // the webpack/rspack dev bundle is imported by Node directly, which rejects
  // Windows drive paths (`C:/...`) as specifiers: https://github.com/nuxt/nuxt/issues/36067
  it('emits runtime dependencies as file URLs when requested', async () => {
    const externals = createServerExternals(createNuxt(true), { fileURLs: true })
    expect(await externalise(externals, 'runtime-dep')).toBe(pathToFileURL(entry).href)
  })
})
