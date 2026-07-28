import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NuxtSSRContext } from 'nuxt/app'

import { detectClientScriptReliance, warnNoScriptsClientReliance } from '../src/runtime/utils/renderer/no-scripts.ts'

function ssrContext (context: Partial<NuxtSSRContext> = {}) {
  return context as unknown as NuxtSSRContext
}

describe('detectClientScriptReliance', () => {
  it('returns no reasons for a static render', () => {
    expect(detectClientScriptReliance(ssrContext())).toEqual([])
    expect(detectClientScriptReliance(ssrContext({
      'teleports': { 'island-fallback=default': '<p>fallback</p>' },
      '~lazyHydratedModules': new Set(),
    }))).toEqual([])
  })

  it('detects lazy hydrated modules', () => {
    const reasons = detectClientScriptReliance(ssrContext({ '~lazyHydratedModules': new Set(['components/Counter.vue']) }))
    expect(reasons).toHaveLength(1)
    expect(reasons[0]).toContain('lazy hydration')
  })

  it('detects nuxt-client components within server components', () => {
    const reasons = detectClientScriptReliance(ssrContext({
      teleports: { 'uid=v-0-1;client=Counter': '<p>client component</p>' },
    }))
    expect(reasons).toHaveLength(1)
    expect(reasons[0]).toContain('nuxt-client')
  })

  it('collects multiple reasons', () => {
    const reasons = detectClientScriptReliance(ssrContext({
      'teleports': { 'uid=v-0-1;client=Counter': '<p>client component</p>' },
      '~lazyHydratedModules': new Set(['components/Counter.vue']),
    }))
    expect(reasons).toHaveLength(2)
  })
})

describe('warnNoScriptsClientReliance', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('warns once per path and stays silent without signals', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    warnNoScriptsClientReliance(ssrContext(), '/static')
    expect(warn).not.toHaveBeenCalled()

    const context = ssrContext({ '~lazyHydratedModules': new Set(['components/Counter.vue']) })
    warnNoScriptsClientReliance(context, '/interactive')
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]![0]).toContain('/interactive')
    expect(warn.mock.calls[0]![0]).toContain('NUXT_E8007')

    warnNoScriptsClientReliance(context, '/interactive')
    expect(warn).toHaveBeenCalledOnce()
  })
})
