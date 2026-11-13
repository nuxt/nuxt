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
    const transform = plugin.transform as (code: string, id: string) => { code: string } | undefined

    configResolved({
      environments: { client: { build: { rolldownOptions: { input: '/entry.js' } } } },
      build: { modulePreload },
    })

    expect(transform('export default 1', '/entry.js?import')?.code).toBe(enabled ? 'import "vite/modulepreload-polyfill";\nexport default 1' : undefined)
    expect(transform('export default 1', '/other.js')).toBeUndefined()
  })
})
