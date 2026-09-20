import { afterEach, describe, expect, it, vi } from 'vitest'
import { consola } from 'consola'
import type { NitroApp } from 'nitro/types'

const { config } = vi.hoisted(() => ({ config: { NUXT_DEV_LOGS: false } }))

vi.mock('nitro', () => ({ definePlugin: (plugin: unknown) => plugin }))
vi.mock('#internal/nuxt/nitro-config.mjs', () => ({
  get NUXT_DEV_LOGS () { return config.NUXT_DEV_LOGS },
}))
vi.mock('../src/runtime/utils/error-channel', () => ({
  publishDevLog: (entry: unknown) => { published.push(entry); return Promise.resolve() },
  useErrorChannel: () => Promise.resolve({}),
}))

const published: unknown[] = []

async function runPlugin () {
  vi.resetModules()
  const { default: plugin } = await import('../src/runtime/plugins/dev-errors.ts')
  ;(plugin as (app: NitroApp) => void)({} as NitroApp)
}

afterEach(() => {
  published.length = 0
})

describe('dev errors plugin', () => {
  it('mirrors server logs onto the channel only when dev logs are enabled', async () => {
    config.NUXT_DEV_LOGS = false
    const quiet = vi.spyOn(consola, 'addReporter')
    await runPlugin()
    expect(quiet).not.toHaveBeenCalled()
    quiet.mockRestore()

    config.NUXT_DEV_LOGS = true
    const added: unknown[] = []
    const addReporter = vi.spyOn(consola, 'addReporter').mockImplementation((reporter) => { added.push(reporter); return consola })
    await runPlugin()
    expect(added).toHaveLength(1)
    ;(added[0] as { log: (entry: unknown) => void }).log({ type: 'log', level: 2, args: ['loud'] })
    await vi.waitFor(() => expect(published).toMatchObject([{ level: 'log', text: 'loud' }]))
    addReporter.mockRestore()
  })
})
