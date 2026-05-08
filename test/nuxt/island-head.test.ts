import { describe, expect, it } from 'vitest'
import { createHead } from '@unhead/vue/server'

import { lockHead } from '../../packages/nuxt/src/head/runtime/island-head'

// Regression test for #32100. The original fix cleared the injected head's
// entries inside `IslandRenderer.setup`; under concurrent prerender Vue's
// module-global `currentInstance` could resolve `injectHead()` to a different
// request's head, so `clear()` would wipe an unrelated route's entries. The
// replacement locks `head.push` during the plugin phase for islands so writes
// from user plugins are discarded, then unlocks before component render. The
// same head instance is used throughout, never mutated for a shared/foreign
// request.
describe('lockHead', () => {
  it('discards push calls until unlock is invoked', () => {
    const head = createHead()
    const baseline = head.entries.size

    const unlock = lockHead(head)

    // Plugin-phase: writes are dropped on the floor.
    head.push({ title: 'plugin title' })
    head.push({ meta: [{ name: 'plugin-meta', content: 'no' }] })
    expect(head.entries.size).toBe(baseline)

    // After unlock (mirrors `app:created` firing post-applyPlugins), pushes
    // land normally so island components contribute as expected.
    unlock()
    head.push({ meta: [{ name: 'island-entry', content: 'yes' }] })
    expect(head.entries.size).toBe(baseline + 1)
  })

  it('returned unlock is idempotent and only restores the original push', () => {
    const head = createHead()
    const original = head.push
    const unlock = lockHead(head)
    expect(head.push).not.toBe(original)
    unlock()
    expect(head.push).toBe(original)
    unlock()
    expect(head.push).toBe(original)
  })
})
