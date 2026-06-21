import type { Plugin } from 'vite'
import { describe, expect, it } from 'vitest'
import { Unhead } from '@unhead/vue/vite'
import { addUnheadTransformCodeFilters } from '../src/head/module.ts'

function getCodeFilter (plugins: Plugin[], name: string) {
  const plugin = plugins.find(plugin => plugin.name === name)
  if (!plugin || typeof plugin.transform !== 'object') {
    throw new TypeError(`Expected ${name} to have an object transform hook`)
  }
  return plugin.transform.filter?.code
}

describe('Unhead transform code filters', () => {
  it('allows the Unhead transforms to process their composables', () => {
    const plugins = Unhead({
      minify: {
        js: source => Promise.resolve(source),
      },
    })

    addUnheadTransformCodeFilters(plugins)

    const headFilter = getCodeFilter(plugins, 'unhead:minify-transform')
    expect(headFilter).toBeInstanceOf(RegExp)
    expect((headFilter as RegExp).test('useHead({})')).toBe(true)
    expect((headFilter as RegExp).test('useServerHead({})')).toBe(true)

    const seoMetaFilter = getCodeFilter(plugins, 'unhead:use-seo-meta-transform')
    expect(seoMetaFilter).toBeInstanceOf(RegExp)
    expect((seoMetaFilter as RegExp).test('useSeoMeta({})')).toBe(true)
    expect((seoMetaFilter as RegExp).test('useServerSeoMeta({})')).toBe(true)
  })

  it('adds a filter to object hooks without replacing their metadata', () => {
    const handler = () => null
    const plugin = {
      name: 'unhead:minify-transform',
      transform: {
        order: 'post' as const,
        filter: { id: /\.vue$/ },
        handler,
      },
    } satisfies Plugin

    addUnheadTransformCodeFilters([plugin])

    expect(plugin.transform).toMatchObject({
      order: 'post',
      filter: {
        id: /\.vue$/,
        code: /\buse(?:Server)?Head\b/,
      },
      handler,
    })
  })
})
