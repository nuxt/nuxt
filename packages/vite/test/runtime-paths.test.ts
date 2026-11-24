import { describe, expect, it } from 'vitest'

import { RuntimePathsPlugin } from '../src/plugins/runtime-paths.ts'

interface IdFilter { exclude: RegExp[] }

describe('RuntimePathsPlugin', () => {
  const { filter, handler } = RuntimePathsPlugin().transform as { filter: { id: IdFilter, code: RegExp }, handler: (code: string, id: string) => { code: string } | undefined }
  const transform = (code: string, id: string) => !filter.id.exclude.some(re => re.test(id)) && filter.code.test(code) ? handler(code, id)?.code : undefined

  it('imports runtime paths into modules that reference vite assets', () => {
    expect(transform('export default "__VITE_ASSET__abc__"', '/app/a.ts')).toBe('import "#internal/nuxt/paths";export default "__VITE_ASSET__abc__"')
    expect(transform('export default "__VITE_PUBLIC_ASSET__abc__"', '/app/a.vue')).toBe('import "#internal/nuxt/paths";export default "__VITE_PUBLIC_ASSET__abc__"')
    expect(transform('export default "__VITE_ASSET__abc__"', '/app/a.vue?vue&type=script')).toBeDefined()
    expect(transform('export default "__VITE_PUBLIC_ASSET__abc__"', '/app/logo.svg?ref=theme.css')).toBeDefined()
  })

  it('skips modules without vite assets', () => {
    expect(transform('export default 1', '/app/a.ts')).toBeUndefined()
  })

  it('skips css files and vue style blocks', () => {
    const code = 'a { background: url(__VITE_ASSET__abc__) }'
    expect(transform(code, '/app/a.css')).toBeUndefined()
    expect(transform(code, '/app/a.scss?inline')).toBeUndefined()
    expect(transform(code, '/app/a.css?v=1.2')).toBeUndefined()
    expect(transform(code, '/app/a.vue?vue&type=style&index=0&lang.css')).toBeUndefined()
  })
})
