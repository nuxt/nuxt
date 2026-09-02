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
  const declaration = nuxtRequire.resolve(name).replace(/\.mjs$/, '.d.mts')
  // a mapping that misses leaves the import as `any`, which resolves nothing and measures as fast
  if (!existsSync(declaration)) { throw new Error(`could not find the declarations for \`${name}\` at ${declaration}`) }
  return [name, [declaration]]
}))

/** A mix weighted the way an app's routes are: mostly static, some parameterised. */
function routeSet (count: number): Route[] {
  const routes: Route[] = []
  const paths: string[] = []
  for (let i = 0; i < count; i++) {
    const segments: Route['segments'] = [{ type: 'static', value: '/api' }, { type: 'static', value: `/group${i % 8}` }, { type: 'static', value: `/route${i}` }]
    const dynamic = i % 5 === 0
    if (dynamic) { segments.push({ type: 'dynamic' }) }
    routes.push({ segments, metadata: { GET: { responseType: `{ id: ${i} }` } } })
    paths.push(`/api/group${i % 8}/route${i}${dynamic ? '/abc' : ''}`)
  }
  return routes.map((route, i) => ({ ...route, route: paths[i] }))
}

function program (routes: Route[], calls: number) {
  rmSync(workspace, { recursive: true, force: true })
  mkdirSync(workspace, { recursive: true })

  writeFileSync(join(workspace, 'server-routes.ts'), [
    compileRoutes([{ routes }], { name: 'GeneratedServerRoutes', moduleSpecifier: 'fetchdts', resolveAgainst: 'ServerRoutes' }).code,
    'interface ServerRoutes extends GeneratedServerRoutes {}',
    'export type StrictFetchPaths = true',
  ].join('\n'))

  const sites = routes.slice(0, calls).map((route, i) => [
    `const r${i} = await $fetch('${route.route}')`,
    `exact<typeof r${i}, { id: ${routes.indexOf(route)} }>()`,
  ].join('\n'))

  writeFileSync(join(workspace, 'calls.ts'), [
    `import type { TypedFetch } from '${typesModule}'`,
    'type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false',
    'declare function exact<A, B> (): Exact<A, B> extends true ? void : never',
    'declare const $fetch: TypedFetch',
    'export async function calls () {',
    ...sites,
    '}',
  ].join('\n'))

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
      paths: { '#build/server-routes': ['./server-routes.ts'], ...dependencies },
    },
    include: ['./calls.ts'],
  }))

  const out = execFileSync(process.execPath, [nuxtRequire.resolve('typescript/bin/tsc'), '-p', join(workspace, 'tsconfig.json'), '--extendedDiagnostics'], { cwd: repoRoot, encoding: 'utf8' })
  const instantiations = Number(/^Instantiations:\s+(\d+)$/m.exec(out)?.[1])
  expect(instantiations, out).toBeGreaterThan(0)
  return instantiations
}

/** The cost of the call sites alone, with the program they sit in measured away. */
function perCall (routeCount: number, calls: number) {
  const routes = routeSet(routeCount)
  return (program(routes, calls) - program(routes, 0)) / calls
}

describe('the cost of resolving a typed `$fetch` call', () => {
  it('stays flat as the route set grows', () => {
    const small = perCall(50, 25)
    const large = perCall(500, 25)

    // an exact-match table is what keeps this flat; a walk over the route tree would not be
    expect(large / small).toBeLessThan(1.5)
  }, 120_000)

  it('stays within budget per call site', () => {
    // measured at ~490 with the types as merged. The ceiling catches a doubling rather than drift,
    // so that a TypeScript upgrade moving the number by a few per cent does not fail the build
    expect(perCall(200, 25)).toBeLessThan(1000)
  }, 120_000)
})
