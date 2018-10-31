import { loadFixture, getPort, Nuxt, rp } from '../utils'

let nuxt, port
const url = route => 'http://localhost:' + port + route

describe('modern build', () => {
  beforeAll(async () => {
    const options = await loadFixture('modern')
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
    const response = await rp(url('/_nuxt/modern-app.js'))
    expect(response).toContain('arrow:()=>"build test"')
  })

  test('should not include es6 syntax in normal resources', async () => {
    const response = await rp(url('/_nuxt/app.js'))
    expect(response).not.toContain('arrow:()=>"build test"')
  })
})
