import { describe, expect, it } from 'vitest'

import { ModulePreloadPolyfillPlugin } from '../src/plugins/client-entry-import.ts'

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
    // the bundler only calls the handler for ids matching the filter
    const transform = (code: string, id: string) => filter.id.test(id) ? handler(code, id) : undefined

    expect(filter.id.test('/entry.js')).toBe(false)

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
