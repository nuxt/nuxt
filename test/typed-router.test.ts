import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { x } from 'tinyexec'
import { describe, expect, it } from 'vitest'
import { runsOnceInMatrix } from './matrix'

const rootDir = fileURLToPath(new URL('./fixtures/basic-types', import.meta.url))

/**
 * Structural checks on the raw generated typed-router.d.ts. Behavioural coverage
 * (route names, params, nesting) lives as in-SFC `IsEqual` assertions in the
 * basic-types fixture pages, verified by its `test:types` script. The checks here
 * are the ones those assertions cannot see: the DTS is `// @ts-nocheck` and TS
 * collapses duplicate object keys on import, so duplicated params and malformed
 * `_RouteFileInfoMap` keys are invisible to any in-SFC assertion.
 */
describe.skipIf(!runsOnceInMatrix)('typed router integration', () => {
  const readTypedRouterDts = () => readFileSync(resolve(rootDir, '.nuxt/types/typed-router.d.ts'), 'utf8')

  it('does not duplicate params when a route overrides its path with an absolute path', async () => {
    const r = await x('nuxt', ['prepare', rootDir])
    expect(r.exitCode, r.stderr).toBe(0)
    const typedRouterDts = readTypedRouterDts()
    // Check for the route definition (accommodates both single-line and multi-line formatting)
    expect(typedRouterDts).toMatch(/'param-id-view-custom':\s*RouteRecordInfo<\s*'param-id-view-custom',\s*'\/param\/:id\(\)\/view-custom',\s*\{\s*id:\s*ParamValue<true>\s*\},\s*\{\s*id:\s*ParamValue<false>\s*\}/)
    // Ensure params are not duplicated
    expect(typedRouterDts).not.toMatch(/\{\s*id:\s*ParamValue<\w+>,\s*id:\s*ParamValue<\w+>\s*\}/)
  })

  it('keeps params added by a root-page definePageMeta path override when the file-based path has none', async () => {
    const r = await x('nuxt', ['prepare', rootDir])
    expect(r.exitCode, r.stderr).toBe(0)
    const typedRouterDts = readTypedRouterDts()
    expect(typedRouterDts).toMatch(/'home-optional':\s*RouteRecordInfo<\s*'home-optional',\s*'\/home\/:someRouteParam\?',\s*\{\s*someRouteParam\?:\s*ParamValueZeroOrOne<true>\s*\},\s*\{\s*someRouteParam\?:\s*ParamValueZeroOrOne<false>\s*\}/)
  })

  it('keeps params added by a nested static-page definePageMeta path override when the file-based path has none', async () => {
    const r = await x('nuxt', ['prepare', rootDir])
    expect(r.exitCode, r.stderr).toBe(0)
    const typedRouterDts = readTypedRouterDts()
    expect(typedRouterDts).toMatch(/'static-parent-child-optional':\s*RouteRecordInfo<\s*'static-parent-child-optional',\s*'\/static-parent\/:someRouteParam\?\/child',\s*\{\s*someRouteParam\?:\s*ParamValueZeroOrOne<true>\s*\},\s*\{\s*someRouteParam\?:\s*ParamValueZeroOrOne<false>\s*\}/)
  })

  it('keeps child params added by a nested absolute definePageMeta path override when the parent also has an absolute override', async () => {
    const r = await x('nuxt', ['prepare', rootDir])
    expect(r.exitCode, r.stderr).toBe(0)
    const typedRouterDts = readTypedRouterDts()
    expect(typedRouterDts).toMatch(/'overridden-child-optional':\s*RouteRecordInfo<\s*'overridden-child-optional',\s*'\/overridden\/:id\(\)\/:childId\?\/child-optional',\s*\{\s*id:\s*ParamValue<true>,\s*childId\?:\s*ParamValueZeroOrOne<true>\s*\},\s*\{\s*id:\s*ParamValue<false>,\s*childId\?:\s*ParamValueZeroOrOne<false>\s*\}/)
  })

  it('keeps file-derived insertion params for a detached child under an absolute-overridden parent', async () => {
    const r = await x('nuxt', ['prepare', rootDir])
    expect(r.exitCode, r.stderr).toBe(0)
    const typedRouterDts = readTypedRouterDts()
    expect(typedRouterDts).toMatch(/'overridden-detached-child-param':\s*RouteRecordInfo<\s*'overridden-detached-child-param',\s*'\/detached',\s*\{\s*id:\s*ParamValue<true>,\s*childId:\s*ParamValue<true>\s*\},\s*\{\s*id:\s*ParamValue<false>,\s*childId:\s*ParamValue<false>\s*\}/)
  })

  // The keys in `_RouteFileInfoMap` are consumed by the `sfc-typed-router` Volar
  // plugin, which resolves each SFC via `relative(rootDir, file)`. If they are
  // generated relative to `process.cwd()` instead, they only match when
  // `process.cwd() === rootDir`; otherwise `useRoute()` in a page silently falls
  // back to `keyof RouteNamedMap`.
  describe('generates _RouteFileInfoMap keys relative to rootDir, not process.cwd()', () => {
    it('when prepared from a different cwd (nuxt prepare <rootDir>)', async () => {
      const r = await x('nuxt', ['prepare', rootDir])
      expect(r.exitCode, r.stderr).toBe(0)
      const dts = readTypedRouterDts()
      // rootDir-relative key present
      expect(dts).toMatch(/'app\/pages\/page\.vue':/)
      // never cwd-relative (the regression prefixed keys with the fixture path)
      expect(dts).not.toMatch(/'[^']*fixtures\/basic-types\/[^']*\.vue':/)
      // never absolute
      expect(dts).not.toMatch(/'\/[^']*\.vue':/)
    })

    it('when prepared with cwd === rootDir', async () => {
      const r = await x('nuxt', ['prepare'], { nodeOptions: { cwd: rootDir } })
      expect(r.exitCode, r.stderr).toBe(0)
      const dts = readTypedRouterDts()
      expect(dts).toMatch(/'app\/pages\/page\.vue':/)
      expect(dts).not.toMatch(/'[^']*fixtures\/basic-types\/[^']*\.vue':/)
      expect(dts).not.toMatch(/'\/[^']*\.vue':/)
    })
  })
})
