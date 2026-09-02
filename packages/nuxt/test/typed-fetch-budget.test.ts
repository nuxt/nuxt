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

function program ({ routes, sites }: ReturnType<typeof routeSet>, calls: number) {
  rmSync(workspace, { recursive: true, force: true })
  mkdirSync(workspace, { recursive: true })

  writeFileSync(join(workspace, 'server-routes.ts'), [
    compileRoutes([{ routes }], { name: 'GeneratedServerRoutes', moduleSpecifier: 'fetchdts', resolveAgainst: 'ServerRoutes' }).code,
    'interface ServerRoutes extends GeneratedServerRoutes {}',
    'export type StrictFetchPaths = true',
    'export type RouteTypesEngine = \'generated\'',
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
  ].join('\n'))

  // the legacy engine's types reach `@nuxt/schema` for the routes nitro contributes, which would
  // otherwise pull the whole config schema into the program under measurement
  writeFileSync(join(workspace, 'schema-stub.ts'), 'export interface ServerRoutes {}\n')

  writeFileSync(join(workspace, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      module: 'preserve',
      moduleResolution: 'bundler',
      target: 'es2022',
      allowImportingTsExtensions: true,
      types: [],
      lib: ['es2023', 'dom'],
      paths: { '#build/server-routes': ['./server-routes.ts'], '@nuxt/schema': ['./schema-stub.ts'], ...dependencies },
    },
    include: ['./calls.ts'],
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
