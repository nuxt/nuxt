import { pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { resolveModulePath } from 'exsolve'
import { createMatcherFromFind } from 'h3/rules'
import type { RouteRulesMatcher } from 'h3/rules'
import { compileRouteRules } from 'h3/rules/compiler'
import { mockEvent } from 'nitro/h3'

import { getRouteRules, matchRouteRules } from '../src/runtime/utils/route-rules.ts'

const state = vi.hoisted(() => ({ match: undefined as RouteRulesMatcher | undefined }))

vi.mock('nitro/app', () => ({
  getRouteRules: (method: string, path: string) => state.match!(method, path),
}))

const routeRules = {
  '/**': { ssr: true },
  '/catchall/route-rules/**': { ssr: false, headers: { 'x-catchall-route-rules': 'applied' } },
}

async function compile (preMerge: boolean) {
  const code = compileRouteRules(routeRules, { preMerge }).toString()
    .replace(/from "(h3[^"]*)"/g, (_, id) => `from ${JSON.stringify(pathToFileURL(resolveModulePath(id, { from: import.meta.url })).href)}`)
  const { findRouteRules } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  state.match = createMatcherFromFind(findRouteRules)
}

describe.each([false, true])('`ssr` route rules through encoded slashes (preMerge: %s)', (preMerge) => {
  it('turns `ssr` off for every spelling of a path a rule turns it off for', async () => {
    await compile(preMerge)

    for (const path of ['/catchall/route-rules/spa', '/catchall/route-rules%2Fspa', '/catchall/route-rules%2fspa', '/catchall//route-rules/spa', '//catchall/route-rules/spa', '/catchall/%2Froute-rules/spa', '/%2Fcatchall/route-rules/spa']) {
      expect(matchRouteRules(path), path).toMatchObject({ headers: { 'x-catchall-route-rules': 'applied' } })
      expect(matchRouteRules(path).ssr, path).toBeFalsy()
      expect(getRouteRules(mockEvent(`http://nuxt${path}`)).ssr, path).toBeFalsy()
    }
  })

  it('applies to the rules nitro matched for a request', async () => {
    await compile(preMerge)
    const path = '/catchall/route-rules%2Fspa'
    const matched = state.match!('GET', path).routeRules as { ssr?: boolean }
    const event = mockEvent(`http://nuxt${path}`)
    event.context.routeRules = matched

    expect(getRouteRules(event).ssr).toBe(false)
    expect(matched.ssr).toBe(true)
  })

  it('leaves `ssr` on for an encoded slash no rule turns it off for', async () => {
    await compile(preMerge)

    for (const path of ['/catchall/other%2Fpage', '/catchall/route-rules-other%2Fspa', '/plain', '//catchall/other/page', '/catchall//route-rules-other/spa']) {
      expect(matchRouteRules(path).ssr, path).toBe(true)
    }
  })
})
