import { describe, expect, it } from 'vitest'
import { resolve } from 'pathe'
import type { Nuxt } from '@nuxt/schema'
import type { Nitro, NitroEventHandler } from 'nitro/types'
import { installMiddlewareReorder } from '../src/index'

function createMocks (options: {
  serverHandlers: NitroEventHandler[]
  optionsHandlers: NitroEventHandler[]
  scannedHandlers: NitroEventHandler[]
  runtimeBaseURL?: boolean
}) {
  const rootDir = resolve('/fake/root')
  const distDir = resolve('/fake/nuxt/dist')

  const nuxt = {
    options: {
      rootDir,
      serverMiddlewareOrder: 'configuredFirst' as const,
      serverHandlers: options.serverHandlers,
      experimental: { runtimeBaseURL: options.runtimeBaseURL ?? false },
      alias: { '#server': resolve(rootDir, 'server') + '/' },
    },
  } as unknown as Nuxt

  const nitro = {
    options: {
      handlers: [...options.optionsHandlers],
      alias: { '#server': resolve(rootDir, 'server') + '/' },
    },
    scannedHandlers: [...options.scannedHandlers],
    routing: { sync: () => {}, globalMiddleware: [] },
  } as unknown as Nitro

  return { nuxt, nitro, distDir, rootDir }
}

describe('server middleware order (issue #26012)', () => {
  it('moves configured middleware to front of scannedHandlers', () => {
    const rootDir = resolve('/fake/root')
    const configuredHandler = resolve(rootDir, 'server/utils/configured.ts')
    const scannedHandler = resolve(rootDir, 'server/middleware/scanned.ts')

    const { nuxt, nitro, distDir } = createMocks({
      serverHandlers: [
        { route: '/**', middleware: true, handler: '#server/utils/configured.ts' },
      ],
      optionsHandlers: [
        { route: '/__nuxt_error', handler: resolve('/fake/nuxt/dist', 'runtime/handlers/renderer') },
        { route: '/**', handler: configuredHandler, middleware: true },
      ],
      scannedHandlers: [
        { route: '/**', handler: scannedHandler, middleware: true },
      ],
    })

    installMiddlewareReorder(nuxt, nitro, distDir)

    expect(nitro.scannedHandlers).toHaveLength(2)
    const [first, second] = nitro.scannedHandlers
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(first!.handler).toBe(configuredHandler)
    expect(second!.handler).toBe(scannedHandler)
  })

  it('reorders correctly on subsequent scannedHandlers assignments (simulating rescan)', () => {
    const rootDir = resolve('/fake/root')
    const configuredHandler = resolve(rootDir, 'server/utils/auth.ts')
    const scannedHandler1 = resolve(rootDir, 'server/middleware/logger.ts')
    const scannedHandler2 = resolve(rootDir, 'server/middleware/cors.ts')

    const { nuxt, nitro, distDir } = createMocks({
      serverHandlers: [
        { middleware: true, handler: '#server/utils/auth.ts' },
      ],
      optionsHandlers: [
        { route: '/**', handler: configuredHandler, middleware: true },
      ],
      scannedHandlers: [
        { route: '/**', handler: scannedHandler1, middleware: true },
      ],
    })

    installMiddlewareReorder(nuxt, nitro, distDir)

    expect(nitro.scannedHandlers[0].handler).toBe(configuredHandler)
    expect(nitro.scannedHandlers[1].handler).toBe(scannedHandler1)

    // Simulate Nitro rescan — configured should still be first
    nitro.scannedHandlers = [
      { route: '/**', handler: scannedHandler1, middleware: true },
      { route: '/**', handler: scannedHandler2, middleware: true },
    ]

    expect(nitro.scannedHandlers[0].handler).toBe(configuredHandler)
    expect(nitro.scannedHandlers[1].handler).toBe(scannedHandler1)
    expect(nitro.scannedHandlers[2].handler).toBe(scannedHandler2)
  })

  it('does nothing when there are no configured middleware handlers', () => {
    const rootDir = resolve('/fake/root')
    const scannedHandler = resolve(rootDir, 'server/middleware/scanned.ts')

    const { nuxt, nitro, distDir } = createMocks({
      serverHandlers: [],
      optionsHandlers: [
        { route: '/__nuxt_error', handler: 'error' },
      ],
      scannedHandlers: [
        { route: '/**', handler: scannedHandler, middleware: true },
      ],
    })

    installMiddlewareReorder(nuxt, nitro, distDir)

    expect(nitro.scannedHandlers.length).toBe(1)
    expect(nitro.scannedHandlers[0].handler).toBe(scannedHandler)
  })
})
