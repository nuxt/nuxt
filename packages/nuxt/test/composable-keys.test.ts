import { describe, expect, it } from 'vitest'

import { ComposableKeysPlugin, detectImportNames } from '../src/core/plugins/composable-keys'

describe('detectImportNames', () => {
  const keyedComposables = {
    useFetch: { source: '#app', argumentLength: 2 },
    useCustomFetch: { source: 'custom-fetch', argumentLength: 2 },
  }
  it('should not include imports from nuxt', async () => {
    expect([...await detectImportNames('import { useFetch } from \'#app\'', {})]).toMatchInlineSnapshot('[]')
    expect([...await detectImportNames('import { useFetch } from \'nuxt/app\'', {})]).toMatchInlineSnapshot('[]')
  })
  it('should pick up other imports', async () => {
    expect([...await detectImportNames('import { useCustomFetch, someThing as someThingRenamed } from \'custom-fetch\'', {})]).toMatchInlineSnapshot(`
      [
        "useCustomFetch",
        "someThingRenamed",
      ]
    `)
    expect([...await detectImportNames('import { useCustomFetch, someThing as someThingRenamed } from \'custom-fetch\'', keyedComposables)]).toMatchInlineSnapshot(`
      [
        "someThingRenamed",
      ]
    `)
  })
})

describe('composable keys plugin', () => {
  const composables = [{
    name: 'useAsyncData',
    source: '#app',
    argumentLength: 2,
  }]
  const transformPlugin = ComposableKeysPlugin({ sourcemap: false, composables }).raw({}, {} as any) as { transform: { handler: (code: string, id: string) => Promise<{ code: string } | null> } }

  it('should add keyed hash when there is none already provided', async () => {
    const code = `
import { useAsyncData } from '#app'
useAsyncData(() => {})
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`
      "import { useAsyncData } from '#app'
      useAsyncData(() => {}, '$HJiaryoL2y')"
    `)
  })

  it('should not add hash when one exists', async () => {
    const code = `useAsyncData(() => {}, 'foo')`
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  it('should not add hash to functions that overshadow the composable', async () => {
    const code = `
const useAsyncData = () => {}
useAsyncData(() => {})
    `
    expect((await transformPlugin.transform.handler(code, 'plugin.ts'))?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  it('should add hash when processing file in `source`', async () => {
    const code = `
const useAsyncData = () => {}
useAsyncData(() => {})
    `
    expect((await transformPlugin.transform.handler(code, '#app'))?.code.trim()).toMatchInlineSnapshot(`
    "const useAsyncData = () => {}
useAsyncData(() => {}, '$QQV3F06xQZ')"
`)
  })
})
