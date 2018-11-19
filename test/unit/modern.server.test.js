import { loadFixture, getPort, Nuxt, rp, wChunk } from '../utils'

let nuxt, port
const url = route => 'http://localhost:' + port + route

describe('modern server mode', () => {
  beforeAll(async () => {
    const options = await loadFixture('modern', { modern: 'server' })
    nuxt = new Nuxt(options)
    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
  })

  test('should use legacy resources by default', async () => {
    const response = await rp(url('/'))
    expect(response).toContain('/_nuxt/app.js')
    expect(response).toContain('/_nuxt/commons.app.js')
  })

  test('should use modern resources for modern resources', async () => {
    const response = await rp(url('/'), {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36'
      }
    })
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

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
