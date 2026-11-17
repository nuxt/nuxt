import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { x } from 'tinyexec'
import { describe, expect, it } from 'vitest'
import { runsOnceInMatrix } from './matrix'
import { fixturePath } from './utils'

const rootDir = fixturePath('basic-types')

/**
 * Structural checks on the raw generated typed-router.d.ts. Behavioural coverage
 * (route names, params, nesting) lives as in-SFC `IsEqual` assertions in the
 * basic-types fixture pages, verified by its `test:types` script. The checks here
 * are the ones those assertions cannot see: the DTS is `// @ts-nocheck` and TS
 * collapses duplicate object keys on import, so duplicated params and malformed
 * `_RouteFileInfoMap` keys are invisible to any in-SFC assertion.
 */
describe.skipIf(!runsOnceInMatrix)('typed router integration', () => {
  const readTypes = (file: string) => readFileSync(resolve(rootDir, '.nuxt/types', file), 'utf8')

  // The keys in `_RouteFileInfoMap` are consumed by the `sfc-typed-router` Volar
  // plugin, which resolves each SFC via `relative(rootDir, file)`, so they have to
  // be relative to `rootDir` wherever `nuxt prepare` runs from.
  it.each([
    ['from a different cwd (nuxt prepare <rootDir>)', ['prepare', rootDir], undefined],
    ['with cwd === rootDir', ['prepare'], rootDir],
  ])('generates types when prepared %s', async (_, args, cwd) => {
    const r = await x('nuxt', args, { nodeOptions: { cwd } })
    expect(r.exitCode, r.stderr).toBe(0)

    const typedRouterDts = readTypes('typed-router.d.ts')
    expect(typedRouterDts).toMatch(/'app\/pages\/page\.vue':/)
    expect(typedRouterDts).not.toMatch(/'[^']*fixtures\/basic-types\/[^']*\.vue':/)
    expect(typedRouterDts).not.toMatch(/'\/[^']*\.vue':/)

    // a route that overrides its path with an absolute path keeps a single `id` param
    expect(typedRouterDts).toMatch(/'param-id-view-custom':\s*RouteRecordInfo<\s*'param-id-view-custom',\s*'\/param\/:id\(\)\/view-custom',\s*\{\s*id:\s*ParamValue<true>\s*\},\s*\{\s*id:\s*ParamValue<false>\s*\}/)
    expect(typedRouterDts).not.toMatch(/\{\s*id:\s*ParamValue<\w+>,\s*id:\s*ParamValue<\w+>\s*\}/)

    // `vue-component-type-helpers` is a dependency of `nuxt`, so a bare specifier is not resolvable
    // from a project that does not depend on it directly, and an absolute path ties the
    // declaration to the machine that produced it
    expect(readTypes('layouts.d.ts').match(/import type \{ ComponentProps \} from "([^"]+)"/)?.[1]).toMatch(/^\.\.\/.*\/vue-component-type-helpers\//)
  })
})
