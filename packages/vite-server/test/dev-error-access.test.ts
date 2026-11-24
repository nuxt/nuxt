import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import type { ViteDevServer } from 'vite'

import { errorChannelAccess } from '../src/dev-errors.ts'

const nuxt = (allowedHosts: string[] | true = ['configured.test']) => ({ options: { devServer: { allowedHosts }, vite: {} } }) as unknown as Nuxt
const server = (allowedHosts: string[] | true, fs: { allow: string[], strict?: boolean } = { allow: ['/repo'] }) => ({ config: { server: { allowedHosts, fs } } }) as unknown as ViteDevServer

describe('errorChannelAccess', () => {
  it('allows the hosts the dev server resolved, including those its plugins added', () => {
    expect(errorChannelAccess(nuxt(), server(['configured.test', 'plugin.test']))).toEqual({ root: ['/repo'], allowedHosts: ['configured.test', 'plugin.test'] })
    expect(errorChannelAccess(nuxt(), server(true)).allowedHosts).toBe(true)
  })

  it('opens any file when the dev server serves any', () => {
    expect(errorChannelAccess(nuxt(), server([], { allow: ['/repo'], strict: false })).root).toBe(false)
  })
})
