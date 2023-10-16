import { describe, expect, it } from 'vitest'

import { detectImportNames } from '../src/plugins/composable-keys'

describe('detectImportNames', () => {
  const keyedComposables = {
    useFetch: { source: '#app', argumentLength: 2 },
    useCustomFetch: { source: 'custom-fetch', argumentLength: 2 }
  }
  it('should not include imports from nuxt', () => {
    expect([...detectImportNames('import { useFetch } from \'#app\'', {})]).toMatchInlineSnapshot('[]')
    expect([...detectImportNames('import { useFetch } from \'nuxt/app\'', {})]).toMatchInlineSnapshot('[]')
  })
  it('should pick up other imports', () => {
    expect([...detectImportNames('import { useCustomFetch, someThing as someThingRenamed } from \'custom-fetch\'', {})]).toMatchInlineSnapshot(`
      [
        "useCustomFetch",
        "someThingRenamed",
      ]
    `)
    expect([...detectImportNames('import { useCustomFetch, someThing as someThingRenamed } from \'custom-fetch\'', keyedComposables)]).toMatchInlineSnapshot(`
      [
        "someThingRenamed",
      ]
    `)
  })
})
