import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { x } from 'tinyexec'
import { describe, expect, it } from 'vitest'

const rootDir = fileURLToPath(new URL('./fixtures/basic-types', import.meta.url))

describe('typed router integration', () => {
  it('does not duplicate params in RouteNamedMap when a child route overrides the path with an absolute path', async () => {
    await x('nuxt', ['prepare', rootDir])
    const typedRouterDtsFile = resolve(rootDir, '.nuxt/types/typed-router.d.ts')
    const typedRouterDts = readFileSync(typedRouterDtsFile, 'utf8')
    // Check for the route definition (accommodates both single-line and multi-line formatting)
    expect(typedRouterDts).toMatch(/'param-id-view-custom':\s*RouteRecordInfo<\s*'param-id-view-custom',\s*'\/param\/:id\(\)\/view-custom',\s*\{\s*id:\s*ParamValue<true>\s*\},\s*\{\s*id:\s*ParamValue<false>\s*\}/)
    // Ensure params are not duplicated
    expect(typedRouterDts).not.toMatch(/\{\s*id:\s*ParamValue<\w+>,\s*id:\s*ParamValue<\w+>\s*\}/)
  })
})
