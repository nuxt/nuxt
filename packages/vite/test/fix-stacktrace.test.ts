import { describe, expect, it, vi } from 'vitest'
import type { NitroApp } from 'nitro/types'
import fixStacktrace from '../src/fix-stacktrace'

vi.mock('#vite-node', () => ({
  viteNodeFetch: {
    fetchModule: vi.fn(),
  },
}))

vi.mock('#internal/nuxt/vite-node-runner.mjs', () => ({
  default: {
    ssrFixStacktrace: vi.fn(),
  },
}))

import { viteNodeFetch } from '#vite-node'

describe('fix-stacktrace plugin', () => {
  it('rewrites SFC error stack trace using sourcemap fetched over IPC', async () => {
    let errorHandler: ((error: any) => Promise<void>) | undefined

    const mockNitroApp = {
      hooks: {
        hook: (event: string, fn: any) => {
          if (event === 'error') {
            errorHandler = fn
          }
        },
      },
    } as unknown as NitroApp

    fixStacktrace(mockNitroApp)
    expect(errorHandler).toBeDefined()

    const mockMap = {
      version: 3,
      sources: ['/project/app.vue'],
      names: [],
      mappings: ';;;;;;;;;;;;;;AAAA',
      file: 'app.vue',
    }

    vi.mocked(viteNodeFetch.fetchModule).mockResolvedValue({
      code: '...',
      map: mockMap,
    })

    const error = new Error('ABC is not defined')
    error.stack = 'Error: ABC is not defined\n    at setup (/project/app.vue:15:16)'

    await errorHandler!(error)

    expect(viteNodeFetch.fetchModule).toHaveBeenCalledWith('/project/app.vue')
    expect(error.stack).toContain('/project/app.vue:1:0')
  })
})
