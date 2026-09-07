import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { pascalCase } from 'scule'
import { getNameFromPath, resolveComponentNameSegments } from '../src/core/utils/index.ts'

describe('getNameFromPath', () => {
  const cases: Record<string, string> = {
    'base.vue': 'base',
    'base/base.vue': 'base',
    'base/base-layout.vue': 'base-layout',
    'base-1-layout': 'base-1-layout',
  }
  it.each(Object.keys(cases))('correctly deduplicates segments - %s', (filename) => {
    expect(getNameFromPath(filename)).toEqual(cases[filename])
  })

  it('should resolve the same name with and without grouping folders', () => {
    expect(getNameFromPath('components/(admin)/user/user/User.vue', 'components')).toBe(getNameFromPath('components/user/user/User.vue', 'components'))
    expect(getNameFromPath('components/user/(admin)/user/User.vue', 'components')).toBe(getNameFromPath('components/user/user/User.vue', 'components'))
  })

  it('should produce a kebab-case name that is stable under separator style', () => {
    const segment = fc.constantFrom('base', 'Base', 'baseLayout', 'index', 'foo', '(group)', 'sub')
    const path = fc.tuple(fc.array(segment, { maxLength: 2 }), segment.filter(s => s !== '(group)'))
      .map(([dirs, file]) => [...dirs, file].join('/') + '.vue')
    fc.assert(fc.property(path, (path) => {
      expect(getNameFromPath(path)).toBe(getNameFromPath(path.replace(/\//g, '\\')))
      expect(getNameFromPath(path)).toMatch(/^[a-z0-9-]*$/)
    }), { numRuns: 1000 })
  })
})

const tests: Array<[string, string[], string]> = [
  ['WithClientOnlySetup', ['Client'], 'ClientWithClientOnlySetup'],
  ['ItemHolderItem', ['Item', 'Holder', 'Item'], 'ItemHolderItem'],
  ['Item', ['Item'], 'Item'],
  ['Item', ['Item', 'Item'], 'Item'],
  ['ItemTest', ['Item', 'Test'], 'ItemTest'],
  ['ThingItemTest', ['Item', 'Thing'], 'ItemThingItemTest'],
  ['Item', ['Thing', 'Item'], 'ThingItem'],
  ['Item', ['Item', 'Holder', 'Item'], 'ItemHolderItem'],
  ['ItemHolder', ['Item', 'Holder', 'Item'], 'ItemHolderItemHolder'],
  ['ThingItemTest', ['Item', 'Thing', 'Foo'], 'ItemThingFooThingItemTest'],
  ['ItemIn', ['Item', 'Holder', 'Item', 'In'], 'ItemHolderItemIn'],
  ['Item', ['Item', 'Holder', 'Test'], 'ItemHolderTestItem'],
  ['Item', ['(group)'], 'Item'],
  ['Item', ['(group)', 'Thing'], 'ThingItem'],
  ['Thing', ['(group)', 'Thing'], 'Thing'],
  ['Thing', ['Thing', '(group)'], 'Thing'],
  ['ItemHolderItem', ['Item', 'Holder', 'Item', 'Holder'], 'ItemHolderItemHolderItem'],
  ['Icones', ['Icon'], 'IconIcones'],
  ['Icon', ['Icones'], 'IconesIcon'],
  ['IconHolder', ['IconHolder'], 'IconHolder'],
  ['GameList', ['Desktop', 'ShareGame', 'Review', 'Detail'], 'DesktopShareGameReviewDetailGameList'],
  ['base-1-layout', [], 'Base1Layout'],
]

describe('components:resolveComponentNameSegments', () => {
  it.each(tests)('resolves %s with prefix parts %s and filename %s', (fileName, prefixParts: string[], result) => {
    expect(pascalCase(resolveComponentNameSegments(fileName, prefixParts))).toBe(result)
  })

  const word = fc.constantFrom('Item', 'Holder', 'Icon', 'Icones', 'Thing', 'Test', 'In', 'Foo', 'GameList', 'base', 'base-layout', 'base1', '(group)')
  const fileName = fc.array(word.filter(part => part !== '(group)'), { maxLength: 3 }).map(parts => pascalCase(parts.join('-')))
  const prefixParts = fc.array(word, { maxLength: 4 })

  it('should always end the name with the file name', () => {
    fc.assert(fc.property(fileName, prefixParts, (fileName, prefixParts) => {
      expect(pascalCase(resolveComponentNameSegments(fileName, prefixParts)).endsWith(pascalCase(fileName))).toBe(true)
    }), { numRuns: 1000 })
  })

  it('should ignore grouping folders wherever they appear', () => {
    fc.assert(fc.property(fileName, prefixParts, fc.array(fc.nat(6), { maxLength: 3 }), (fileName, prefixParts, positions) => {
      const withGroups = [...prefixParts]
      for (const position of positions) {
        withGroups.splice(position % (withGroups.length + 1), 0, '(group)')
      }
      expect(pascalCase(resolveComponentNameSegments(fileName, withGroups)))
        .toBe(pascalCase(resolveComponentNameSegments(fileName, prefixParts.filter(part => part !== '(group)'))))
    }), { numRuns: 1000 })
  })
})
