import { describe, expect, it } from 'vitest'
import { createHead } from '@unhead/vue/server'

import { freezeHead } from '../../packages/nuxt/src/head/runtime/island-head'

// Regression test for #32100.
describe('freezeHead', () => {
  it('discards push calls until unfreeze is invoked', () => {
    const head = createHead()
    const baseline = head.entries.size

    const unfreeze = freezeHead(head)
    head.push({ title: 'plugin title' })
    head.push({ meta: [{ name: 'plugin-meta', content: 'no' }] })
    expect(head.entries.size).toBe(baseline)

    unfreeze()
    head.push({ meta: [{ name: 'island-entry', content: 'yes' }] })
    expect(head.entries.size).toBe(baseline + 1)
  })

  it('returned unfreeze is idempotent and only restores the original push', () => {
    const head = createHead()
    const original = head.push
    const unfreeze = freezeHead(head)
    expect(head.push).not.toBe(original)
    unfreeze()
    expect(head.push).toBe(original)
    unfreeze()
    expect(head.push).toBe(original)
  })
})
