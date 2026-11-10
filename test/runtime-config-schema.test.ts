import { spawn } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, setup, startServer, useTestContext } from '@nuxt/test-utils/e2e'

import { isBuilt, runsOncePerEnvInMatrix } from './matrix'

const shouldRun = runsOncePerEnvInMatrix && isBuilt

if (shouldRun) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/runtime-config-schema', import.meta.url)),
    dev: false,
    server: true,
    browser: false,
    env: { NUXT_API_SECRET: 'secret' },
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

/** Start the built server with `env`, and resolve with its output once it exits or listens. */
function runServer (env: Record<string, string>) {
  const outputDir = useTestContext().nuxt!.options.nitro.output!.dir!
  return new Promise<{ code: number | null, output: string }>((resolve) => {
    const server = spawn(process.execPath, [join(outputDir, 'server/index.mjs')], {
      env: { ...process.env, PORT: '0', HOST: '127.0.0.1', ...env },
    })
    let output = ''
    const onData = (chunk: Buffer) => {
      output += chunk
      if (output.includes('Listening on')) {
        server.kill()
      }
    }
    server.stdout.on('data', onData)
    server.stderr.on('data', onData)
    const timeout = setTimeout(() => server.kill(), 20_000)
    server.on('exit', (code) => {
      clearTimeout(timeout)
      resolve({ code, output })
    })
  })
}

describe.skipIf(!shouldRun)('runtime config schemas', () => {
  it('coerces values with a schema and casts the rest with destr', async () => {
    await startServer({
      env: {
        NUXT_API_SECRET: '4848e0',
        NUXT_PORT: '4000',
        NUXT_PLAIN: '4848e0',
        NUXT_PUBLIC_MODE: 'production',
        NUXT_PUBLIC_FLAG: 'true',
      },
    })

    const expected = { apiSecret: '4848e0', port: 4000, plain: 4848e0, mode: 'production', flag: true }
    expect(await $fetch('/api/config')).toEqual({ event: expected, shared: expected })
    expect(await $fetch<string>('/')).toContain('production')
  })

  it('uses schema defaults when no environment variable is set', async () => {
    await startServer({ env: { NUXT_API_SECRET: 'secret' } })

    expect(await $fetch('/api/config')).toMatchObject({
      event: { apiSecret: 'secret', port: 3000, plain: '', mode: 'preview', flag: false },
    })
  })

  it('freezes the shared config and gives each event its own copy with the environment applied', async () => {
    await startServer({ env: { NUXT_API_SECRET: 'secret', NUXT_PORT: '4000' } })

    expect(await $fetch('/api/isolation')).toEqual({
      sharedIsStable: true,
      sharedIsFrozen: true,
      eventIsCached: true,
      eventIsCopy: true,
      secondPort: 5001,
      secondMode: 'preview',
      sharedPort: 4000,
      sharedMode: 'preview',
    })
  })

  it('does not start with a value that does not match its schema', async () => {
    const { code, output } = await runServer({ NUXT_API_SECRET: 'secret', NUXT_PORT: 'abc', NUXT_PUBLIC_MODE: 'staging' })

    expect(code).not.toBe(0)
    expect(output).toContain('NUXT_E8014')
    expect(output).toContain('`port` (`NUXT_PORT`) must be number')
    expect(output).toContain('`public.mode` (`NUXT_PUBLIC_MODE`) must be "preview" | "production", but received "staging"')
  })

  it('coerces values with a schema from a module', async () => {
    await startServer({ env: { NUXT_API_SECRET: 'secret', NUXT_MODULE_TOKEN: 'token', NUXT_MODULE_COUNT: '5' } })

    expect(await $fetch('/api/module')).toEqual({ moduleToken: 'token', moduleCount: 5 })
  })

  it('starts with a value from a module that does not match its schema, or is missing', async () => {
    await startServer({ env: { NUXT_API_SECRET: 'secret', NUXT_MODULE_COUNT: 'abc' } })

    expect(await $fetch('/api/module')).toEqual({ moduleToken: null, moduleCount: 1 })

    const { output } = await runServer({ NUXT_API_SECRET: 'secret', NUXT_MODULE_COUNT: 'abc' })
    expect(output).toContain('Listening on')
    expect(output).toContain('NUXT_E8014')
    expect(output).toContain('`moduleToken` is required')
    expect(output).toContain('`moduleCount` (`NUXT_MODULE_COUNT`) must be number')
  })

  it('does not start without a required value', async () => {
    const { code, output } = await runServer({})

    expect(code).not.toBe(0)
    expect(output).toContain('`apiSecret` is required. Set `NUXT_API_SECRET`')
  })
})
