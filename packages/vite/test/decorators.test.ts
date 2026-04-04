import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import { DecoratorsPlugin } from '../src/plugins/decorators'

function matchesFilter (
  filter: {
    code?: string
    id?: {
      include?: RegExp[]
      exclude?: RegExp[]
    }
  },
  code: string,
  id: string,
) {
  if (filter.code && !code.includes(filter.code)) {
    return false
  }

  if (filter.id?.include?.length && !filter.id.include.some(re => re.test(id))) {
    return false
  }

  if (filter.id?.exclude?.some(re => re.test(id))) {
    return false
  }

  return true
}

describe('DecoratorsPlugin transform filter', () => {
  const nuxt = {
    options: {
      experimental: { decorators: true } as Nuxt['options']['experimental'],
      rootDir: '/tmp',
      modulesDir: [],
    },
  }

  // @ts-expect-error - we only need nuxt.options.experimental.decorators, rootDir, and modulesDir for this test
  const plugin = DecoratorsPlugin(nuxt as Nuxt)

  if (typeof plugin.transform !== 'object' || !plugin.transform?.filter) {
    throw new Error('Expected object-based transform with filter')
  }

  const filter = plugin.transform.filter as {
    code?: string
    id?: {
      include?: RegExp[]
      exclude?: RegExp[]
    }
  }

  it('matches TypeScript files containing decorator syntax', () => {
    expect(matchesFilter(filter, '@sealed class A {}', '/src/example.ts')).toBe(true)
  })

  it('does not match CSS files', () => {
    expect(matchesFilter(filter, '@import "./base.css";', '/src/styles.css')).toBe(false)
    expect(matchesFilter(filter, '@import "./base.scss";', '/src/styles.scss')).toBe(false)
  })
})
