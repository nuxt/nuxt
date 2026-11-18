import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import type { Nuxt } from '@nuxt/schema'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolve } from 'pathe'
import '../src/impl.ts'
import { serverStandalone } from '../src/configs/server.ts'
import type { WebpackConfigContext } from '../src/utils/config.ts'
import type { ServerExternals } from '../src/utils/server-externals.ts'
import { createServerExternals } from '../src/utils/server-externals.ts'

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

function createNuxt (dev: boolean, nitroMajor: 2 | 3 = 2) {
  return {
    'options': {
      dev,
      rootDir: root,
      modulesDir: [resolve(root, 'node_modules')],
      alias: {},
      build: { transpile: [] },
      dir: { shared: 'shared' },
      _nitroMajor: nitroMajor,
    },
    '~runtimeDependencies': ['runtime-dep'],
  } as unknown as Nuxt
}

function externalise (externals: ServerExternals, request: string) {
  return new Promise<string | boolean | undefined>((resolve, reject) => {
    externals({ request, context: root }, (error, result) => error ? reject(error) : resolve(result))
  })
}

function externalFromBuild (nuxt: Nuxt, isDev: boolean) {
  const ctx = { nuxt, isDev, config: { externals: [] } } as unknown as WebpackConfigContext
  serverStandalone(ctx)
  return (ctx.config.externals as unknown as ServerExternals[])[0]!
}

describe('createServerExternals', () => {
  it('keeps runtime dependencies as absolute paths by default', async () => {
    expect(await externalise(createServerExternals(createNuxt(false)), 'runtime-dep')).toBe(entry)
  })

  it('keeps runtime dependencies as absolute paths in development unless requested', async () => {
    expect(await externalise(createServerExternals(createNuxt(true)), 'runtime-dep')).toBe(entry)
  })

  it('emits runtime dependencies as file URLs when requested', async () => {
    expect(await externalise(createServerExternals(createNuxt(false), { fileURLs: true }), 'runtime-dep')).toBe(pathToFileURL(entry).href)
  })
})

describe('serverStandalone', () => {
  it('emits file URLs for the development bundle that Node imports from disk', async () => {
    expect(await externalise(externalFromBuild(createNuxt(true), true), 'runtime-dep')).toBe(pathToFileURL(entry).href)
  })

  it('keeps absolute paths in development on nitro v3, which bundles the entry itself', async () => {
    expect(await externalise(externalFromBuild(createNuxt(true, 3), true), 'runtime-dep')).toBe(entry)
  })

  it('keeps absolute paths in production', async () => {
    expect(await externalise(externalFromBuild(createNuxt(false), false), 'runtime-dep')).toBe(entry)
  })
})
