import { describe, expect, it } from 'vitest'
import type { NuxtSSRContext } from 'nuxt/app'

import { replaceIslandTeleports } from '../src/runtime/utils/renderer/islands.ts'

function ssrContext (teleports: Record<string, string>) {
  return { teleports } as unknown as NuxtSSRContext
}

describe('replaceIslandTeleports', () => {
  it('injects slot and component teleports after their anchors', () => {
    const html = '<main><div data-island-uid="v-0-1" data-island-slot="default" class="x"></div><span data-island-uid="v-0-1" data-island-component="Counter" hidden></span></main>'
    const result = replaceIslandTeleports(ssrContext({
      'uid=v-0-1;slot=default': '<p>slot content</p>',
      'uid=v-0-1;client=Counter': '<p>client component</p>',
    }), html)

    expect(result).toBe('<main><div data-island-uid="v-0-1" data-island-slot="default" class="x"><p>slot content</p></div><span data-island-uid="v-0-1" data-island-component="Counter" hidden><p>client component</p></span></main>')
  })

  it('only injects at the first matching anchor', () => {
    const html = '<i data-island-uid="v-0-1" data-island-slot="s"></i><i data-island-uid="v-0-1" data-island-slot="s"></i>'
    const result = replaceIslandTeleports(ssrContext({ 'uid=v-0-1;slot=s': '<p>once</p>' }), html)

    expect(result).toBe('<i data-island-uid="v-0-1" data-island-slot="s"><p>once</p></i><i data-island-uid="v-0-1" data-island-slot="s"></i>')
  })

  it('ignores non-teleport keys and anchors without pending content', () => {
    const html = '<div data-island-uid="v-0-1">root</div><div data-island-uid="v-0-2" data-island-slot="other"></div>'
    const result = replaceIslandTeleports(ssrContext({
      'island-fallback=default': '<p>fallback</p>',
      'uid=zz-9;slot=ghost': '<p>ghost</p>',
    }), html)

    expect(result).toBe(html)
  })

  it('injects nested island teleports regardless of teleport key order', () => {
    const result = replaceIslandTeleports(ssrContext({
      'uid=inner;slot=default': '<p>deep</p>',
      'uid=outer;slot=default': '<div data-island-uid="inner" data-island-slot="default"></div>',
    }), '<div data-island-uid="outer" data-island-slot="default"></div>')

    expect(result).toBe('<div data-island-uid="outer" data-island-slot="default"><div data-island-uid="inner" data-island-slot="default"><p>deep</p></div></div>')
  })
})
