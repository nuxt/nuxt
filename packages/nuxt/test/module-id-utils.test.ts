import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { JS_ID_RE, VUE_ID_RE, getLoader, isJS, isVue, parseModuleId } from '../src/core/utils/plugins.ts'

const extension = fc.constantFrom('.vue', '.js', '.ts', '.mjs', '.cjs', '.mts', '.cts', '.jsx', '.tsx', '.css', '.json', '.vue.js', '')
const basename = fc.constantFrom('index', 'app.config', 'a.b', 'Foo')
const query = fc.constantFrom(
  '', '?vue', '?vue&type=script&setup=true&lang.ts', '?vue&type=template&lang.js', '?vue&type=style&index=0&lang.css',
  '?macro=true', '?macro=true&vue&type=script',
)
const moduleId = fc.tuple(fc.constantFrom('/root/', '/root/pages/', ''), basename, extension, query)
  .map(([dir, base, ext, query]) => dir + base + ext + query)

describe('module id utils', () => {
  it('should split a module id into pathname and search without loss', () => {
    fc.assert(fc.property(moduleId, (id) => {
      const { pathname, search } = parseModuleId(id)
      expect(pathname + search).toBe(id)
      expect(pathname).not.toContain('?')
      expect(search === '' || search.startsWith('?')).toBe(true)
    }), { numRuns: 1000 })
  })

  it('should agree between isJS, the JS id filter and the loader', () => {
    fc.assert(fc.property(moduleId, (id) => {
      if (isJS(id)) {
        expect(JS_ID_RE.test(id)).toBe(true)
      }
      expect(isJS(id)).toBe(getLoader(id) === 'ts' || getLoader(id) === 'tsx')
    }), { numRuns: 1000 })
  })

  it('should agree between the vue loader and the vue id filters', () => {
    fc.assert(fc.property(moduleId, (id) => {
      if (getLoader(id) === 'vue') {
        expect(VUE_ID_RE.test(id)).toBe(true)
        expect(isVue(id)).toBe(true)
      }
    }), { numRuns: 1000 })
  })

  it('should keep every specific vue filter narrower than the general one', () => {
    fc.assert(fc.property(moduleId, fc.subarray(['script', 'template'] as const, { minLength: 1 }), (id, type) => {
      if (isVue(id, { type: [...type] })) {
        expect(isVue(id)).toBe(true)
      }
    }), { numRuns: 1000 })
  })
})
