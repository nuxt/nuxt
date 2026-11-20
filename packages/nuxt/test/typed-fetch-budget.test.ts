import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { compileRoutes } from 'fetchdts/compiler'
import type { Route } from 'fetchdts/compiler'
import process from 'node:process'
import { describe, expect, it } from 'vitest'

/**
 * What it costs TypeScript to resolve a `$fetch` call against the generated route types.
 *
 * This aims to pin the current behaviour - that the cost of calling `$fetch` doesn't increase with
 * the number of routes.
 *
 * The program under measurement imports the signatures Nuxt ships and points `#build/server-routes`
 * at a module the route compiler emitted, so it should catch a regression in either.
 */

const repoRoot = resolve(import.meta.dirname, '../../..')
const workspace = join(repoRoot, 'node_modules/.cache/typed-fetch-budget')
const typesModule = join(repoRoot, 'packages/nuxt/src/app/types/fetch.ts')

// the program sits under `node_modules`, where pnpm's layout does not resolve the packages the
// types import, so each is mapped to the copy `nuxt` itself resolves
const nuxtRequire = createRequire(join(repoRoot, 'packages/nuxt/package.json'))
const dependencies = Object.fromEntries(['fetchdts', 'ofetch'].map((name) => {
  const declaration = nuxtRequire.resolve(name).replace(/\.(?:m|c)?js$/, ext => ext === '.cjs' ? '.d.cts' : '.d.mts')
  // a mapping that misses leaves the import as `any`, which resolves nothing and measures as fast
  if (!existsSync(declaration)) { throw new Error(`could not find the declarations for \`${name}\` at ${declaration}`) }
  return [name, [declaration]]
}))

/** A mix weighted the way an app's routes are: mostly static, some parameterised. */
function routeSet (count: number) {
  const routes: Route[] = []
  /** What a call site writes to reach each route, and the response it must resolve to. */
  const sites: Array<{ path: string, response: string }> = []

  for (let i = 0; i < count; i++) {
    const segments: Route['segments'] = [{ type: 'static', value: '/api' }, { type: 'static', value: `/group${i % 8}` }, { type: 'static', value: `/route${i}` }]
    const dynamic = i % 5 === 0
    if (dynamic) { segments.push({ type: 'dynamic' }) }
    routes.push({ segments, metadata: { GET: { responseType: `{ id: ${i} }` } } })
    sites.push({ path: `/api/group${i % 8}/route${i}${dynamic ? '/abc' : ''}`, response: `{ id: ${i} }` })
  }

  return { routes, sites }
}

interface ProgramOptions {
  strict?: boolean
  strictFetchPaths?: boolean
  /** Whether `params` is accepted as a query alias, as it is on nitro v3 without `routeTypedFetch`. */
  paramsAlias?: boolean
  /** Module-level source appended to the program. */
  source?: string[]
  /** Whether the program resolves `#app`, so that the source can import the composables. */
  composables?: boolean
}

const appDir = join(repoRoot, 'packages/nuxt/src/app')

function program ({ routes, sites }: ReturnType<typeof routeSet>, calls: number, { strict = true, strictFetchPaths = true, paramsAlias = false, source = [], composables = false }: ProgramOptions = {}) {
  rmSync(workspace, { recursive: true, force: true })
  mkdirSync(workspace, { recursive: true })

  writeFileSync(join(workspace, 'server-routes.ts'), [
    compileRoutes([{ routes }], { name: 'GeneratedServerRoutes', moduleSpecifier: 'fetchdts', resolveAgainst: 'ServerRoutes' }).code,
    'interface ServerRoutes extends GeneratedServerRoutes {}',
    `export type StrictFetchPaths = ${strictFetchPaths}`,
    'export type RouteTypesEngine = \'generated\'',
    `export type ParamsAlias = ${paramsAlias}`,
  ].join('\n'))

  const callSites = sites.slice(0, calls).map((site, i) => [
    `const r${i} = await $fetch('${site.path}')`,
    `exact<typeof r${i}, ${site.response}>()`,
  ].join('\n'))

  writeFileSync(join(workspace, 'calls.ts'), [
    `import type { TypedFetch } from '${typesModule}'`,
    'type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false',
    // the mismatch has to be an argument the call cannot supply: a `never` *return* type is not an
    // error at the call site, so an assertion written that way checks nothing
    'declare function exact<A, B> (...mismatch: Exact<A, B> extends true ? [] : [never]): void',
    'declare const $fetch: TypedFetch',
    'export async function calls () {',
    ...callSites,
    '}',
    ...source,
  ].join('\n'))

  // the legacy engine's types reach `@nuxt/schema` for the routes nitro contributes, which would
  // otherwise pull the whole config schema into the program under measurement
  writeFileSync(join(workspace, 'schema-stub.ts'), 'export interface ServerRoutes {}\n')

  writeFileSync(join(workspace, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      strict,
      noEmit: true,
      skipLibCheck: true,
      module: 'preserve',
      moduleResolution: 'bundler',
      target: 'es2022',
      allowImportingTsExtensions: true,
      types: [],
      lib: ['es2023', 'dom', ...composables ? ['dom.iterable', 'webworker'] : []],
      paths: {
        '#build/server-routes': ['./server-routes.ts'],
        // the composables reach the whole config schema, so they get the real one
        ...composables
          ? { '#app': [join(appDir, 'index')], '#app/*': [join(appDir, '*')], 'nuxt/app': [join(appDir, 'index')], '#unhead/composables': [join(repoRoot, 'packages/nuxt/src/head/runtime/composables')] }
          : { '@nuxt/schema': ['./schema-stub.ts'] },
        ...dependencies,
      },
      ...composables ? { noUncheckedIndexedAccess: true, verbatimModuleSyntax: true, isolatedModules: true, moduleDetection: 'force', allowJs: true, resolveJsonModule: true, esModuleInterop: true } : {},
    },
    include: ['./calls.ts', ...composables ? [join(repoRoot, 'packages/nuxt/src/build-stubs.d.ts')] : []],
  }))

  const out = execFileSync(process.execPath, [nuxtRequire.resolve('typescript/bin/tsc'), '-p', join(workspace, 'tsconfig.json'), '--extendedDiagnostics'], { cwd: repoRoot, encoding: 'utf8' })
  const instantiations = Number(/^Instantiations:\s+(\d+)$/m.exec(out)?.[1])
  expect(instantiations, out).toBeGreaterThan(0)
  return instantiations
}

describe('the cost of resolving a typed `$fetch` call', () => {
  it('does not grow with the route set, and stays within budget per call site', () => {
    const calls = 25
    const small = routeSet(50)
    const large = routeSet(500)

    const perCallSmall = (program(small, calls) - program(small, 0)) / calls
    const perCallLarge = (program(large, calls) - program(large, 0)) / calls

    // an exact-match table for the fully static paths is what keeps this flat; a walk over the
    // route tree would not, and is how the implementation this replaced ran out of instantiations
    expect(perCallLarge / perCallSmall).toBeLessThan(1.5)

    // ~534 as merged. The ceiling catches a doubling rather than drift, so that a TypeScript
    // upgrade moving the number by a few per cent does not fail the build
    expect(perCallLarge).toBeLessThan(1000)
  }, 300_000)
})

describe('a typed `$fetch` read through its own signature', () => {
  const source = [
    'export function api<T> (url: string, options: Parameters<typeof $fetch>[1] = {}) { return $fetch<T>(url, { ...options }) }',
    'export function rawApi<T> (url: string, options: Parameters<typeof $fetch.raw>[1] = {}) { return $fetch.raw<T>(url, { ...options }) }',
    'export function post<T> (url: string, body: Record<string, unknown>) { return $fetch<T>(url, { method: \'POST\', body }) }',
    'export const request: Parameters<typeof $fetch>[0] = new Request(\'https://example.com\')',
    'export const created: Parameters<ReturnType<typeof $fetch.create>>[1] = { method: \'PATCH\' }',
    'export async function named (url: string) {',
    '  await $fetch<unknown>(url, { method: \'PUT\' })',
    '  await $fetch<{ id?: number }>(url, { method: \'POST\' })',
    '  await $fetch<{}>(url, { method: \'POST\' })',
    '}',
  ]

  it.each([true, false].flatMap(paramsAlias => [true, false].flatMap(strict => [true, false].map(strictFetchPaths => ({ paramsAlias, strict, strictFetchPaths })))))('compiles against a large route set with a catch-all that validates a body (paramsAlias: $paramsAlias, strict: $strict, strictFetchPaths: $strictFetchPaths)', (options) => {
    const set = routeSet(50)
    set.routes.push({ segments: [{ type: 'wildcard' }], metadata: { POST: { responseType: '{ proxied: true }', bodyType: '{ target: string }' } } })
    // ~7k as merged; the ceiling catches TypeScript measuring the request shape's variance (~190k)
    expect(program(set, 0, { ...options, source })).toBeLessThan(50_000)
  }, 60_000)
})

describe('the options of `useFetch` read through its own signature', () => {
  it('compiles against a large route set', () => {
    const source = [
      `import type { UseFetch } from '${join(appDir, 'composables/fetch.ts')}'`,
      'declare const useFetch: UseFetch',
      'export type Options = Parameters<typeof useFetch>[1]',
    ]
    // ~410k as merged, nearly all of it checking the composables themselves; measuring the variance
    // of `UseFetchOptions` instead of declaring it costs over 5M with this route set
    expect(program(routeSet(50), 0, { source, composables: true })).toBeLessThan(1_000_000)
  }, 120_000)
})
