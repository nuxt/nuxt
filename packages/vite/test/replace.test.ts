import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { afterAll, describe, expect, it } from 'vitest'
import { join } from 'pathe'
import { createServer } from 'vite'
import { ReplacePlugin } from '../src/plugins/replace.ts'

const rootDir = await mkdtemp(join(tmpdir(), 'nuxt-replace-'))
await writeFile(join(rootDir, 'main.js'), [
  'export const client = import.meta.client',
  'export const envName = import.meta.envName',
  'export const literal = \'import.meta.envName\'',
  'export const property = foo.import.meta.client',
  'export const nested = import.meta.client.value',
  '',
].join('\n'))
await writeFile(join(rootDir, 'worker.js'), 'self.postMessage(import.meta.client)\n')

afterAll(() => rm(rootDir, { recursive: true, force: true }))

async function withServer<T> (fn: (server: Awaited<ReturnType<typeof createServer>>) => Promise<T>) {
  const server = await createServer({
    root: rootDir,
    configFile: false,
    logLevel: 'silent',
    server: { middlewareMode: true, ws: false },
    optimizeDeps: { noDiscovery: true },
    plugins: [ReplacePlugin()],
    environments: {
      client: {
        define: {
          'import.meta.client': 'true',
          'import.meta.envName': JSON.stringify('development'),
        },
      },
    },
  })
  try {
    return await fn(server)
  } finally {
    await server.close()
  }
}

describe('ReplacePlugin', () => {
  it('should replace `import.meta` defines in client modules', async () => {
    const result = await withServer(server => server.environments.client.transformRequest('/main.js'))
    expect(result?.code).toMatchInlineSnapshot(`
      "export const client = true
      export const envName = "development"
      export const literal = 'import.meta.envName'
      export const property = foo.import.meta.client
      export const nested = import.meta.client.value
      "
    `)
  })

  it('should keep the env preamble of `@vite-ignore` workers valid', async () => {
    const code = await withServer(async (server) => {
      await server.environments.client.transformRequest('/@vite/env')
      const result = await server.environments.client.transformRequest('/worker.js?worker_file&type=ignore')
      return result!.code
    })
    expect(code).toContain('"import.meta.client": true')
    expect(code).toContain('"import.meta.envName": "development"')
    expect(code).toContain('self.postMessage(true)')
  })

  it('should not apply outside the unbundled dev client', () => {
    const plugin = ReplacePlugin()
    const applyToEnvironment = plugin.applyToEnvironment as (environment: any) => unknown
    const environment = (consumer: string, isBundled: boolean) => ({
      config: { consumer, isBundled, define: {} },
      getTopLevelConfig: () => ({ define: {} }),
    })

    expect(applyToEnvironment(environment('server', false))).toBe(false)
    expect(applyToEnvironment(environment('client', true))).toBe(false)
    expect(applyToEnvironment(environment('client', false))).not.toBe(false)
  })
})
