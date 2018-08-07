import consola from 'consola'
import { loadFixture, getPort, Nuxt, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null

describe('custom indexes', () => {
  test('/ (custom router index)', async () => {
    const options = loadFixture('routes-custom-index')
    nuxt = new Nuxt(options)
    port = await getPort()
    await nuxt.listen(port, '0.0.0.0')
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes('<h1>Custom Page Route</h1>')).toBe(true)
  })

  test('/ (pages router index)', async () => {
    const options = loadFixture('routes-pages-index')
    nuxt = new Nuxt(options)
    port = await getPort()
    await nuxt.listen(port, '0.0.0.0')
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes('<h1>Custom Page Route</h1>')).toBe(true)
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
