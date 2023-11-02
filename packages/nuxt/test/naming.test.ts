import { describe, expect, it } from 'vitest'
import { pascalCase } from 'scule'
import { getNameFromPath, resolveComponentNameSegments } from '../src/core/utils'

describe('getNameFromPath', () => {
  const cases: Record<string, string> = {
    'base.vue': 'base',
    'base/base.vue': 'base',
    'base/base-layout.vue': 'base-layout',
    'base-1-layout': 'base-1-layout'
  }
  it.each(Object.keys(cases))('correctly deduplicates segments - %s', (filename) => {
    expect(getNameFromPath(filename)).toEqual(cases[filename])
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
  ['ItemHolderItem', ['Item', 'Holder', 'Item', 'Holder'], 'ItemHolderItemHolderItem'],
  ['Icones', ['Icon'], 'IconIcones'],
  ['Icon', ['Icones'], 'IconesIcon'],
  ['IconHolder', ['IconHolder'], 'IconHolder'],
  ['GameList', ['Desktop', 'ShareGame', 'Review', 'Detail'], 'DesktopShareGameReviewDetailGameList'],
  ['base-1-layout', [], 'Base1Layout']
]

describe('components:resolveComponentNameSegments', () => {
  it.each(tests)('resolves %s with prefix parts %s and filename %s', (fileName, prefixParts: string[], result) => {
    expect(pascalCase(resolveComponentNameSegments(fileName, prefixParts))).toBe(result)
  })
})
