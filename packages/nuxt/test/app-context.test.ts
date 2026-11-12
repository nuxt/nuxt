import { describe, expect, it, vi } from 'vitest'

describe('app context', () => {
  it('should share the active instance across duplicate module instances', async () => {
    const first = await import('#app/internal/context')
    vi.resetModules()
    const second = await import('#app/internal/context')
    expect(second).not.toBe(first)

    const instance = { id: 'duplicate' }
    first.getContext<typeof instance>('app-context-test', {}).set(instance)
    expect(second.getContext<typeof instance>('app-context-test', {}).tryUse()).toBe(instance)
  })
})
