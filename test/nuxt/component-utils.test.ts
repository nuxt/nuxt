import { describe, expect, it } from 'vitest'

import { getFragmentHTML } from '../../packages/nuxt/src/app/components/utils'

describe('getFragmentHTML', () => {
  it('walks large fragments without overflowing the call stack', () => {
    const fragment = document.createDocumentFragment()
    const start = document.createComment('[')
    fragment.append(start)

    for (let i = 0; i < 20_000; i++) {
      const element = document.createElement('span')
      element.textContent = String(i)
      fragment.append(element)
    }

    fragment.append(document.createComment(']'))

    const html = getFragmentHTML(start)
    expect(html).toHaveLength(20_000)
    expect(html?.[0]).toBe('<span>0</span>')
    expect(html?.[19_999]).toBe('<span>19999</span>')
  })

  it('stops at the fragment boundary and clears island slot contents', () => {
    const fragment = document.createDocumentFragment()
    const start = document.createComment('[')
    const element = document.createElement('div')
    const slot = document.createElement('span')
    const ignored = document.createElement('p')

    slot.dataset.islandSlot = 'default'
    slot.textContent = 'slot content'
    element.append('before', slot, 'after')
    ignored.textContent = 'outside fragment'
    fragment.append(start, element, document.createComment(']'), ignored)

    expect(getFragmentHTML(start, true)).toEqual([
      '<div>before<span data-island-slot="default"></span>after</div>',
    ])
  })
})
