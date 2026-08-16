import { describe, expect, it } from 'vitest'
import type { NuxtSSRContext } from 'nuxt/app'

import { renderStreamedIslandTeleports } from '../src/runtime/utils/renderer/islands.ts'

function ssrContext (teleports: Record<string, string>) {
  return { teleports, islandContext: undefined } as unknown as NuxtSSRContext
}

describe('renderStreamedIslandTeleports', () => {
  it('renders slot and component teleports as templates', () => {
    const html = renderStreamedIslandTeleports(ssrContext({
      'uid=v-0-1;slot=default': '<p>slot content</p>',
      'uid=v-0-1;client=Counter': '<p>client component</p>',
    }))

    expect(html).toContain('data-island-uid="v-0-1"')
    expect(html).toContain('data-island-slot="default"')
    expect(html).toContain('data-island-component="Counter"')
  })

  it('escapes attribute values derived from teleport keys', () => {
    const html = renderStreamedIslandTeleports(ssrContext({
      'uid=v-0-1;slot="><img src=x onerror=alert(1)>': '<p>content</p>',
    }))

    // The hostile slot name must not break out of the data-island-slot attribute
    expect(html).not.toContain('data-island-slot=""><img')
    expect(html).not.toContain('<img src=x onerror=alert(1)>')
  })

  it('escapes attribute values derived from client teleport keys', () => {
    const html = renderStreamedIslandTeleports(ssrContext({
      'uid=v-0-1;client="><script>alert(1)</script>': '<p>content</p>',
    }))

    expect(html).not.toContain('data-island-component=""><script')
    expect(html).not.toContain('<script>alert(1)</script>')
  })
})
