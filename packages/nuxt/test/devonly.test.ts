import { describe, expect, it } from 'vitest'
import { DevOnlyPlugin } from '../src/core/plugins/dev-only'
import { normalizeLineEndings } from './utils'

const pluginVite = DevOnlyPlugin({}).raw({}, { framework: 'vite' }) as { transform: { handler: (code: string, id: string) => { code: string } | null } }

const viteTransform = async (source: string, id: string) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  const result = await (pluginVite.transform.handler as Function)(source, id)
  return typeof result === 'string' ? result : result?.code
}

describe('test devonly transform ', () => {
  it('test dev only treeshaking', async () => {
    const result = await viteTransform(`<template>
    <div>
      <LazyDevOnly>
        <SomeDevOnlyComponent></SomeDevOnlyComponent>
      </LazyDevOnly>
    </div>
    <SomeComponent>
      <lazy-dev-only>
        test
      </lazy-dev-only>
    </SomeComponent>
    <div>
      <DevOnly>
        <SomeDevOnlyComponent></SomeDevOnlyComponent>
      </DevOnly>
    </div>
    <SomeComponent>
      <dev-only>
        test
      </dev-only>
    </SomeComponent>
    </template>`, 'some id')

    expect(normalizeLineEndings(result)).toMatchInlineSnapshot(`
      "<template>
          <div>
            
          </div>
          <SomeComponent>
            
          </SomeComponent>
          <div>
            
          </div>
          <SomeComponent>
            
          </SomeComponent>
          </template>"
    `)

    expect(result).not.toContain('dev-only')
    expect(result).not.toContain('DevOnly')
    expect(result).not.toContain('lazy-dev-only')
    expect(result).not.toContain('LazyDevOnly')
  })

  it('should not remove class -> nuxt#24491', async () => {
    const source = `<template>
    <DevOnly>
      <div class="red">This is red.</div>
      <template #fallback>
        <div class="red">This should also be red.</div>
      </template>
    </DevOnly>
  </template>
  `

    const result = await viteTransform(source, 'some id')

    expect(result).toMatchInlineSnapshot(`
      "<template>
          
              <div class="red">This should also be red.</div>
            
        </template>
        "
    `)
  })
})
