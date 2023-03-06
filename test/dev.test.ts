import { fileURLToPath } from 'node:url'
// eslint-disable-next-line import/order
import { setup, $fetch } from '@nuxt/test-utils'
import { describe, it, expect } from 'vitest'

await setup({
  rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  dev: true,
  nuxtConfig: {
    app: {
      baseURL: '/test'
    }
  }
})
describe('dev tests', () => {
  it('should just work', async () => {
    expect(await $fetch('/')).toMatchInlineSnapshot(`
      "<!DOCTYPE html>
      <html >
      <head><meta charset=\\"utf-8\\">
      <meta name=\\"viewport\\" content=\\"width=1024, initial-scale=1\\">
      <title>- Fixture</title><link rel=\\"preload\\" as=\\"style\\" href=\\"/_nuxt/assets/global.css\\"><link rel=\\"preload\\" as=\\"style\\" href=\\"/_nuxt/virtual.css\\"><link rel=\\"preload\\" as=\\"style\\" href=\\"/_nuxt/assets/plugin.css\\"><link rel=\\"modulepreload\\" as=\\"script\\" crossorigin href=\\"/_nuxt/home/harlan/forks/nuxt3/packages/nuxt/src/app/entry.ts\\"><link rel=\\"stylesheet\\" href=\\"/_nuxt/assets/global.css\\"><link rel=\\"stylesheet\\" href=\\"/_nuxt/virtual.css\\"><link rel=\\"stylesheet\\" href=\\"/_nuxt/assets/plugin.css\\"></head>
      <body ><div id=\\"__nuxt\\"><div><div>Extended layout from foo</div><div><h1>[...slug].vue</h1><div>catchall at    &gt; Network:  http:</div><div>Middleware ran: true</div></div></div></div><script>window.__NUXT__=(function(a){return {data:{hey:{foo:\\"bar\\",baz:\\"qux\\"}},state:{},_errors:{},serverRendered:true,config:{public:{ids:[1,2,3],needsFallback:a,testConfig:123},app:{baseURL:\\"\\\\u002F\\",buildAssetsDir:\\"\\\\u002F_nuxt\\\\u002F\\",cdnURL:a}},prerenderedAt:1678028804677}}(\\"\\"))</script><script type=\\"module\\" src=\\"/_nuxt/@vite/client\\" crossorigin></script><script type=\\"module\\" src=\\"/_nuxt/home/harlan/forks/nuxt3/packages/nuxt/src/app/entry.ts\\" crossorigin></script></body>
      </html>"
    `)
  })
})

