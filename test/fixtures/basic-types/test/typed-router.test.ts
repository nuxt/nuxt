import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('typed router integration', () => {
  it('does not duplicate params in RouteNamedMap when a child route overrides the path with an absolute path', () => {
    const typedRouterDtsFile = resolve(import.meta.dirname, '../.nuxt/types/typed-router.d.ts')
    const typedRouterDts = readFileSync(typedRouterDtsFile, 'utf8')
    expect(typedRouterDts).toContain(`'param-id-view-custom': RouteRecordInfo<'param-id-view-custom', '/param/:id()/view-custom', { id: ParamValue<true> }, { id: ParamValue<false> }>,`)
    expect(typedRouterDts).not.toContain(`'param-id-view-custom': RouteRecordInfo<'param-id-view-custom', '/param/:id()/view-custom', { id: ParamValue<true>, id: ParamValue<true> }, { id: ParamValue<false>, id: ParamValue<false> }>,`)
  })
})
