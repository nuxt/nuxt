import { fileURLToPath } from 'node:url'
// eslint-disable-next-line import/order
import { setup, $fetch } from '@nuxt/test-utils'
import { describe, it, expect } from 'vitest'

await setup({
  rootDir: fileURLToPath(new URL('./fixtures/minimal', import.meta.url)),
  dev: true,
  nuxtConfig: {
    app: {
      baseURL: '/test'
    },
    runtimeConfig: {
      public: {
        foo: 'bar',
      }
    }
  }
})
describe('dev tests', () => {
  it('config is overriden', async () => {
    const html = await $fetch('/')
    const expr = /window.__NUXT__=({.*})<\/script>/.exec(html)![1]
    expect(expr).toMatchInlineSnapshot('"{data:{},state:{},_errors:{},serverRendered:true,config:{public:{foo:\\"bar\\"},app:{baseURL:\\"\\\\u002Ftest\\",buildAssetsDir:\\"\\\\u002F_nuxt\\\\u002F\\",cdnURL:\\"\\"}}}"')

    // expr is a javascript object string, but not valid JSON, we need to turn it a real object
    const obj = JSON.parse(expr.replace(/(\w+):/g, '"$1":'))
    expect(obj.config.public.foo).toBe('bar')
    expect(obj.config.app.baseURL).toBe('/test')
  })
})

