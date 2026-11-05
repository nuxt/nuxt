import { describe, expect, it, vi } from 'vitest'

import layouts from '#build/layouts.mjs'

describe('experimental.preloadInitialLayout', () => {
  it('loads the layout of the initial route before anything renders it', async () => {
    const layout = layouts.default as { __asyncResolved?: unknown }

    await vi.waitFor(() => expect(layout.__asyncResolved).toBeTruthy())
  })
})
