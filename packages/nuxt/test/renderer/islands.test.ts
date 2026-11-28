import { describe, expect, it } from 'vitest'
import type { NuxtSSRContext } from 'nuxt/app'

import { getClientIslandResponse, renderStreamedIslandTeleports, replaceIslandTeleports } from '../../src/runtime/server/renderer/islands.ts'

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

describe('renderStreamedIslandTeleports', () => {
  it('emits a template per slot and component teleport, skipping other keys', () => {
    const result = renderStreamedIslandTeleports(ssrContext({
      'uid=v-0-1;slot=default': '<p>slot</p>',
      'uid=v-0-1;client=Counter': '<p>client</p>',
      'uid=;slot=nameless': '<p>no uid</p>',
      'uid=v-0-1;slot=': '<p>no name</p>',
      'island-fallback=default': '<p>fallback</p>',
    }), ' nonce="n"')

    expect(result.split('<script')[0]).toBe('<template data-island-uid="v-0-1" data-island-slot="default"><p>slot</p></template><template data-island-uid="v-0-1" data-island-component="Counter"><p>client</p></template>')
    expect(result).toContain('<script nonce="n">')
  })

  it('returns an empty string without island teleports', () => {
    expect(renderStreamedIslandTeleports(ssrContext({ 'island-fallback=default': '<p>fallback</p>' }))).toBe('')
  })
})

describe('getClientIslandResponse', () => {
  it('falls back to the client teleport keyed by component uid, not a slot with the same name', () => {
    const response = getClientIslandResponse({
      islandContext: { components: { Counter: { props: {} } }, slots: {} },
      teleports: {
        'uid=v-0-1;slot=Counter': '<p>slot</p>',
        'uid=v-0-1;client=Counter': '<!--teleport start anchor--><p>client</p>',
      },
    } as unknown as NuxtSSRContext)

    expect(response?.Counter?.html).toBe('<p>client</p>')
  })

  it('prefers the teleport keyed by component uid and strips teleport anchors', () => {
    const response = getClientIslandResponse({
      islandContext: { components: { A: { props: {} }, B: { props: {} }, C: { props: {} } }, slots: {} },
      teleports: {
        'A': '<!--teleport start anchor--><p>direct</p>',
        'uid=v-0-1;client=A': '<p>keyed</p>',
        'B': '<!--teleport start anchor-->',
        'uid=v-0-1;client=B': '<!--teleport start anchor--><p>first</p>',
        'uid=v-0-2;client=B': '<p>second</p>',
      },
    } as unknown as NuxtSSRContext)

    expect(response?.A?.html).toBe('<p>direct</p>')
    expect(response?.B?.html).toBe('<p>first</p>')
    expect(response?.C?.html).toBe('')
  })

  it('gives each component only its own slot teleports', () => {
    const response = getClientIslandResponse({
      islandContext: { components: { A: { props: {} }, B: { props: {} }, C: { props: {} } }, slots: {} },
      teleports: {
        'island-slot=A;default': '<p>a default</p>',
        'island-slot=B;default': '<p>b default</p>',
        'island-slot=A;footer': '<p>a footer</p>',
        'island-slot=A;': '<p>nameless</p>',
        'uid=v-0-1;slot=A': '<p>island slot</p>',
      },
    } as unknown as NuxtSSRContext)

    expect(response?.A?.slots).toEqual({ default: '<p>a default</p>', footer: '<p>a footer</p>' })
    expect(response?.B?.slots).toEqual({ default: '<p>b default</p>' })
    expect(response?.C?.slots).toEqual({})
  })
})
