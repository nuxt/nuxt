import { loadFixture, getPort, Nuxt } from '../utils'

let port
let nuxt = null

describe('custom indexes', () => {
  test('/ (custom router index)', async () => {
    const options = loadFixture('routes-custom-index')
    nuxt = new Nuxt(options)
    port = await getPort()
    await nuxt.listen(port, '0.0.0.0')
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes('<h1>Custom Page Route</h1>')).toBe(true)
    await nuxt.close()
  })

  test('/ (pages router index)', async () => {
    const options = loadFixture('routes-pages-index')
    nuxt = new Nuxt(options)
    port = await getPort()
    await nuxt.listen(port, '0.0.0.0')
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes('<h1>Custom Page Route</h1>')).toBe(true)
    await nuxt.close()
  })
})
