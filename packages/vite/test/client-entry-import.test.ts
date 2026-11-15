import { describe, expect, it } from 'vitest'
import { build } from 'vite'
import type { Rolldown } from 'vite'

import { ClientEntryImportPlugin, ModulePreloadPolyfillPlugin } from '../src/plugins/client-entry-import.ts'

describe('ModulePreloadPolyfillPlugin', () => {
  it.each([
    [{}, true],
    [{ polyfill: true }, true],
    [{ polyfill: false }, false],
    [false, false],
  ] as const)('modulePreload: %j -> polyfilled: %s', (modulePreload, enabled) => {
    const plugin = ModulePreloadPolyfillPlugin()
    const configResolved = plugin.configResolved as (config: unknown) => void
    const { filter, handler } = plugin.transform as { filter: { id: RegExp }, handler: (code: string, id: string) => { code: string } | undefined }
    const transform = (code: string, id: string) => filter.id.test(id) ? handler(code, id) : undefined

    expect(filter?.id.test('/entry.js')).toBe(false)

    configResolved({
      environments: { client: { build: { rolldownOptions: { input: '/entry.js' } } } },
      build: { modulePreload },
    })

    expect(transform('export default 1', '/entry.js?import')?.code).toBe(enabled ? 'import "vite/modulepreload-polyfill";\nexport default 1' : undefined)
    expect(transform('export default 1', '/entry.js')?.code).toBe(enabled ? 'import "vite/modulepreload-polyfill";\nexport default 1' : undefined)
    expect(transform('export default 1', '/other.js')).toBeUndefined()
    expect(transform('export default 1', '/entry.jsx')).toBeUndefined()
  })
})

describe('ClientEntryImportPlugin', () => {
  it.each([true, false])('imports the specifier into the entry of a vite build (enabled: %s)', async (enabled) => {
    const modules: Record<string, string> = {
      '/entry.js': 'import "/other.js"\nconsole.log("entry")',
      '/other.js': 'console.log("other")',
      '/side-effect.js': 'console.log("side effect")',
    }
    const output = await build({
      configFile: false,
      logLevel: 'silent',
      plugins: [
        ClientEntryImportPlugin('test:entry-import', '/side-effect.js', () => enabled),
        {
          name: 'test:virtual-modules',
          resolveId (id) {
            if (id in modules) { return id }
          },
          load (id) {
            return modules[id]
          },
        },
      ],
      build: {
        write: false,
        minify: false,
        rolldownOptions: { input: '/entry.js' },
      },
    }) as Rolldown.RolldownOutput
    const code = output.output.find(chunk => chunk.type === 'chunk' && chunk.isEntry)
    expect(code?.type === 'chunk' && code.code).toContain('"other"')
    expect(code?.type === 'chunk' && code.code.includes('"side effect"')).toBe(enabled)
  })
})
