import { describe, expect, it, vi } from 'vitest'

vi.mock('nuxt/internal/dev-error', () => ({
  ERROR_CHANNEL_ENV: 'NUXT_DEV_ERROR_CHANNEL',
  setErrorChannelForwarding: () => {},
  useErrorChannel: () => Promise.resolve({ fetchHandler: () => undefined }),
  createErrorReport: () => Promise.resolve({}),
  createDevErrorReporter: (options: { mapStack: (error: unknown) => void }) => (error: unknown) => {
    options.mapStack(error)
    return Promise.resolve(undefined)
  },
  serializeErrorCause: () => undefined,
}))

const { observeDevError, setDevErrorContext } = await import('../src/runtime/dev-error.ts')

setDevErrorContext({
  server: { ssrFixStacktrace: (error: Error) => { error.stack = error.stack!.replace('/.nuxt/app.mjs:1:1', '/app.vue:12:3') } } as never,
  cwd: '/repo',
  channel: '/__nuxt_dev__/error',
})

const raised = 'Error: boom\n    at setup (/repo/.nuxt/app.mjs:1:1)'
const mapped = 'Error: boom\n    at setup (/repo/app.vue:12:3)'

describe('dev error stack mapping', () => {
  it('maps a stack that is a getter without a setter', async () => {
    const error = new Error('boom')
    Object.defineProperty(error, 'stack', { get: () => raised, set: undefined, configurable: true })

    await observeDevError(error)

    expect(error.stack).toBe(mapped)
  })

  it('leaves a non-configurable stack as raised', async () => {
    const error = new Error('boom')
    Object.defineProperty(error, 'stack', { value: raised, writable: false, configurable: false })

    await expect(observeDevError(error)).resolves.toBeUndefined()
    expect(error.stack).toBe(raised)
  })
})
