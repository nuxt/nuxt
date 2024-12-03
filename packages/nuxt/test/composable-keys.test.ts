import { describe, expect, it } from 'vitest'
import * as Parser from 'acorn'

import { ComposableKeysPlugin, detectImportNames } from '../src/core/plugins/composable-keys'

describe('detectImportNames', () => {
  const keyedComposables = {
    useFetch: { source: '#app', argumentLength: 2 },
    useCustomFetch: { source: 'custom-fetch', argumentLength: 2 },
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

describe('composable keys plugin', () => {
  const composables = [{
    name: 'useAsyncData',
    source: '#app',
    argumentLength: 2,
  }]
  const transformPlugin = ComposableKeysPlugin({ sourcemap: false, rootDir: '/', composables }).raw({}, {} as any) as { transform: (code: string, id: string) => { code: string } | null }

  it('should add keyed hash when there is none already provided', () => {
    const code = `
import { useAsyncData } from '#app'
useAsyncData(() => {})
    `
    expect(transformPlugin.transform.call({
      parse: (code: string, opts: any = {}) => Parser.parse(code, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        locations: true,
        ...opts,
      }),
    }, code, 'plugin.ts')?.code.trim()).toMatchInlineSnapshot(`
      "import { useAsyncData } from '#app'
      useAsyncData(() => {}, '$yXewDLZblH')"
    `)
  })

  it('should not add hash when one exists', () => {
    const code = `useAsyncData(() => {}, 'foo')`
    expect(transformPlugin.transform.call({
      parse: (code: string, opts: any = {}) => Parser.parse(code, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        locations: true,
        ...opts,
      }),
    }, code, 'plugin.ts')?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })

  it('should not add hash composables is imported from somewhere else', () => {
    const code = `
const useAsyncData = () => {}
useAsyncData(() => {})
    `
    expect(transformPlugin.transform.call({
      parse: (code: string, opts: any = {}) => Parser.parse(code, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        locations: true,
        ...opts,
      }),
    }, code, 'plugin.ts')?.code.trim()).toMatchInlineSnapshot(`undefined`)
  })
})
