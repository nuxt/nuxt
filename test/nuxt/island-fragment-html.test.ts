import { describe, expect, it } from 'vitest'

import { getFragmentHTML } from '../../packages/nuxt/src/app/components/utils'

describe('getFragmentHTML', () => {
  it('purges island slots from an element when withoutSlots is set', () => {
    const el = document.createElement('div')
    el.innerHTML = '<span data-island-slot="default">slot content</span>'

    expect(getFragmentHTML(el, true)).toEqual([
      '<div><span data-island-slot="default"></span></div>',
    ])
  })

  // https://github.com/nuxt/nuxt/issues/31509 — a nested server component can
  // leave `vnode.el` pointing at a node without `querySelectorAll` (e.g. a text
  // or comment node), which used to throw `clone.querySelectorAll is not a function`.
  it('does not throw for a non-element node when withoutSlots is set', () => {
    const text = document.createTextNode('nested server component')
    expect(() => getFragmentHTML(text, true)).not.toThrow()

    const comment = document.createComment('anchor')
    expect(() => getFragmentHTML(comment, true)).not.toThrow()
  })
})
