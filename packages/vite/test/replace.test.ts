import { describe, expect, it } from 'vitest'
import type { Plugin } from 'vite'
import { ReplacePlugin } from '../src/plugins/replace.ts'

function createEnvironment (define: Record<string, string> = {
  'import.meta.client': 'true',
  'import.meta.envName': JSON.stringify('development'),
}) {
  return {
    name: 'client',
    getTopLevelConfig: () => ({ define }),
    config: { define: {} },
  } as any
}

function environmentPlugin (define?: Record<string, string>) {
  const plugin = ReplacePlugin() as Plugin & {
    applyToEnvironment: (environment: unknown) => Plugin
  }
  return plugin.applyToEnvironment(createEnvironment(define))
}

function getTransform (plugin: Plugin) {
  if (typeof plugin.transform !== 'object' || !plugin.transform?.handler || !plugin.transform.filter) {
    throw new Error('Expected object-based transform with filter')
  }
  return plugin.transform as {
    filter: {
      id?: {
        exclude?: RegExp | RegExp[]
      }
    }
    handler: (this: unknown, code: string, id: string, options?: { moduleType: string }) => Promise<{ code: string } | string | null | undefined>
  }
}

function isExcluded (filter: { id?: { exclude?: RegExp | RegExp[] } }, id: string) {
  const exclude = filter.id?.exclude
  if (!exclude) { return false }
  return [exclude].flat().some(re => re.test(id))
}

// Mirrors the env preamble Vite injects for `@vite-ignore` workers (string-keyed defines).
const viteIgnoreWorkerPreamble = `const defines = {
  "import.meta.envName": "development",
  "import.meta.client": "true",
};
if (import.meta.client) console.log(import.meta.envName);
`

describe('ReplacePlugin', () => {
  // https://github.com/nuxt/nuxt/issues/36657
  it('excludes @vite-ignore worker module ids from transform', () => {
    const plugin = environmentPlugin()
    const transform = getTransform(plugin)

    expect(isExcluded(transform.filter, '/app/worker.js?worker_file&type=ignore')).toBe(true)
    expect(isExcluded(transform.filter, '/app/worker.js?import&worker_file&type=ignore')).toBe(true)
    expect(isExcluded(transform.filter, '/app/worker.js?worker_file&type=module')).toBe(false)
    expect(isExcluded(transform.filter, '/app/main.js')).toBe(false)
  })

  it('would corrupt Vite ignore-worker env string keys if replace ran (documents #36657)', async () => {
    const plugin = environmentPlugin()
    const transform = getTransform(plugin)

    const result = await transform.handler.call({}, viteIgnoreWorkerPreamble, '/app/worker.js', { moduleType: 'js' })
    const code = typeof result === 'string' ? result : result?.code
    expect(code).toContain('""development""')
  })

  it('still replaces import.meta.* defines in normal modules', async () => {
    const plugin = environmentPlugin()
    const transform = getTransform(plugin)
    const source = 'export const ready = import.meta.client && import.meta.envName === "development"\n'

    expect(isExcluded(transform.filter, '/app/main.js')).toBe(false)

    const result = await transform.handler.call({}, source, '/app/main.js', { moduleType: 'js' })
    const code = typeof result === 'string' ? result : result?.code
    expect(code).toBe('export const ready = true && "development" === "development"\n')
  })
})
