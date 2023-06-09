import { getPort, loadFixture, Nuxt } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null

describe('postcss configuration as function', () => {
  beforeAll(async () => {
    const options = await loadFixture('postcss-function')
    nuxt = new Nuxt(options)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, '0.0.0.0')
  })

  for (const path of ['/css', '/postcss']) {
    test(path, async () => {
      const window = await nuxt.server.renderAndGetWindow(url(path))

      const headHtml = window.document.head.innerHTML
      expect(headHtml.replace(/\s+/g, '').replace(/;}/g, '}')).toContain('div.red{background-color:blue}.red{color:red}')

      const element = window.document.querySelector('.red')
      expect(element).not.toBe(null)
      expect(element.textContent).toContain('This is red')
      expect(element.className).toBe('red')
      // t.is(window.getComputedStyle(element).color, 'red')
    })
  }
})
