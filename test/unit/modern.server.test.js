import consola from 'consola'
import { loadFixture, getPort, Nuxt, rp, wChunk } from '../utils'

let nuxt, port
const url = route => 'http://localhost:' + port + route
const modernUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36'
const modernInfo = mode => `Modern bundles are detected. Modern mode (\`${mode}\`) is enabled now.`

describe('modern server mode', () => {
  beforeAll(async () => {
    const options = await loadFixture('modern')
    nuxt = new Nuxt(options)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
  })

  test('should detect server modern mode', async () => {
    await nuxt.server.renderAndGetWindow(url('/'))
    expect(consola.info).toHaveBeenCalledWith(modernInfo('server'))
  })

  test('should use legacy resources by default', async () => {
    const response = await rp(url('/'))
    expect(response).toContain('/_nuxt/app.js')
    expect(response).toContain('/_nuxt/commons.app.js')
  })

  test('should use modern resources for modern resources', async () => {
    const response = await rp(url('/'), { headers: { 'user-agent': modernUA } })
    expect(response).toContain('/_nuxt/modern-app.js')
    expect(response).toContain('/_nuxt/modern-commons.app.js')
  })

  test('should include es6 syntax in modern resources', async () => {
    const response = await rp(url(`/_nuxt/modern-${wChunk('pages/index.js')}`))
    expect(response).toContain('arrow:()=>"build test"')
  })

  test('should not include es6 syntax in normal resources', async () => {
    const response = await rp(url(`/_nuxt/${wChunk('pages/index.js')}`))
    expect(response).toContain('arrow:function(){return"build test"}')
  })

  test('should contain legacy http2 pushed resources', async () => {
    const { headers: { link } } = await rp(url('/'), {
      resolveWithFullResponse: true
    })
    expect(link).toEqual([
      '</_nuxt/runtime.js>; rel=preload; crossorigin=use-credentials; as=script',
      '</_nuxt/commons.app.js>; rel=preload; crossorigin=use-credentials; as=script',
      '</_nuxt/app.js>; rel=preload; crossorigin=use-credentials; as=script',
      `</_nuxt/${wChunk('pages/index.js')}>; rel=preload; crossorigin=use-credentials; as=script`
    ].join(', '))
  })

  test('should contain module http2 pushed resources', async () => {
    const { headers: { link } } = await rp(url('/'), {
      headers: { 'user-agent': modernUA },
      resolveWithFullResponse: true
    })
    expect(link).toEqual([
      '</_nuxt/modern-runtime.js>; rel=preload; crossorigin=use-credentials; as=script',
      '</_nuxt/modern-commons.app.js>; rel=preload; crossorigin=use-credentials; as=script',
      '</_nuxt/modern-app.js>; rel=preload; crossorigin=use-credentials; as=script',
      `</_nuxt/modern-${wChunk('pages/index.js')}>; rel=preload; crossorigin=use-credentials; as=script`
    ].join(', '))
  })

  test('Vary header should contain User-Agent', async () => {
    const { headers: { vary } } = await rp(url('/'), {
      resolveWithFullResponse: true,
      headers: { 'user-agent': modernUA }
    })
    expect(vary).toContain('User-Agent')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
