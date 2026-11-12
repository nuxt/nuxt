import { afterEach, describe, expect, it, vi } from 'vitest'
import * as mlly from 'mlly'
import { fileURLToPath } from 'node:url'
import { resolve } from 'pathe'

import { interopDefault } from '../src/internal/interop.ts'
import { lookupNodeModuleSubpath, parseNodeModulePath } from '../src/internal/node-module.ts'
import { resolveModuleExportNames } from '../src/internal/exports.ts'

const fixtureDir = fileURLToPath(new URL('./exports-fixture', import.meta.url))
const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)))

describe('parseNodeModulePath', () => {
  const cases = [
    '',
    '/project/node_modules/pathe/dist/index.mjs',
    '/project/node_modules/@nuxt/kit/dist/index.mjs',
    '/project/node_modules/@nuxt/kit',
    '/project/src/index.ts',
    'file:///project/node_modules/ufo/dist/index.mjs',
  ]

  it.each(cases)('should match mlly for %s', (path) => {
    expect(parseNodeModulePath(path)).toStrictEqual(mlly.parseNodeModulePath(path))
  })
})

describe('lookupNodeModuleSubpath', () => {
  const cases = [
    resolve(repoRoot, 'node_modules/pathe/dist/index.mjs'),
    resolve(repoRoot, 'node_modules/pathe/dist/utils.mjs'),
    resolve(repoRoot, 'node_modules/mlly/dist/index.mjs'),
    resolve(repoRoot, 'src/index.ts'),
  ]

  it.each(cases)('should match mlly for %s', async (path) => {
    await expect(lookupNodeModuleSubpath(path)).resolves.toStrictEqual(await mlly.lookupNodeModuleSubpath(path))
  })
})

describe('interopDefault', () => {
  const cases: Array<[string, () => unknown]> = [
    ['no default', () => ({ a: 1 })],
    ['null', () => null],
    ['undefined default', () => ({ default: undefined, a: 1 })],
    ['primitive default', () => ({ default: 42, a: 1 })],
    ['object default', () => ({ default: { a: 1 }, b: 2 })],
    ['function default', () => ({ default: () => 'hi', b: 2 })],
    ['conflicting key', () => ({ default: { a: 'from default' }, a: 'from namespace' })],
  ]

  it.each(cases)('should match mlly for %s', (_name, create) => {
    expect(describeResult(interopDefault(create()))).toStrictEqual(describeResult(mlly.interopDefault(create())))
  })

  function describeResult (value: unknown) {
    if (typeof value === 'function') {
      return { type: 'function', result: (value as () => unknown)(), keys: Object.keys(value) }
    }
    return { type: typeof value, value }
  }

  it('should preserve a function default export', () => {
    const fn = () => 'hi'
    expect(interopDefault({ default: fn, extra: 1 })).toBe(fn)
  })
})

describe('resolveModuleExportNames', () => {
  it('should collect exports, following star re-exports', async () => {
    const names = await resolveModuleExportNames(resolve(fixtureDir, 'index.ts'))
    expect(names).toMatchInlineSnapshot(`
      [
        "named",
        "renamed",
        "fn",
        "Klass",
        "default",
        "ns",
        "fromStar",
      ]
    `)
  })

  it('should return an empty array for a module without exports', async () => {
    await expect(resolveModuleExportNames(resolve(fixtureDir, 'empty.ts'))).resolves.toStrictEqual([])
  })

  it('should return an empty array for an unresolvable module', async () => {
    await expect(resolveModuleExportNames('./does-not-exist', { url: new URL('index.ts', `${new URL('./exports-fixture/', import.meta.url)}`) })).resolves.toStrictEqual([])
  })

  describe('without the default parser', () => {
    const parsers = ['rolldown/utils', 'oxc-parser', 'mlly']

    afterEach(() => {
      for (const parser of parsers) {
        vi.doUnmock(parser)
      }
    })

    async function importWithout (missing: string[]) {
      for (const parser of missing) {
        vi.doMock(parser, () => { throw new Error(`Cannot find package '${parser}'`) })
      }
      vi.resetModules()
      const { resolveModuleExportNames } = await import('../src/internal/exports.ts')
      return resolveModuleExportNames(resolve(fixtureDir, 'index.ts'))
    }

    it.each([1, 2])('should fall back to the next parser with %i unavailable', async (count) => {
      await expect(importWithout(parsers.slice(0, count))).resolves.toContain('fromStar')
    })

    it('should throw a diagnostic when no parser is available', async () => {
      await expect(importWithout(parsers)).rejects.toThrow(/needs a parser/)
    })
  })
})
