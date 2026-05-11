import { describe, expect, it } from 'vitest'
import type { ResolvedConfig } from 'vite'

import { resolveServerEntry } from './config.ts'

describe('vite config entry resolution', () => {
  it('uses the explicit server entry fallback when only a client entry is configured', () => {
    const config = {
      environments: {},
      build: {
        rollupOptions: {
          input: {
            entry: '/nuxt/app/entry.async.mjs',
          },
        },
      },
    } as unknown as ResolvedConfig

    expect(resolveServerEntry(config, '/nuxt/app/entry-spa.mjs')).toBe('/nuxt/app/entry-spa.mjs')
  })
})
