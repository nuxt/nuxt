import { loadFixture, getPort, Nuxt, rp } from '../utils'

let port
let nuxt
const url = route => 'http://localhost:' + port + route

const tests = [
  ['relative publicPath can be used in dev ssr', {
    build: {
      publicPath: './_nuxt/'
    }
  }],
  ['relative publicPath can be used in production ssr', {
    dev: false,
    build: {
      publicPath: './_nuxt/'
    }
  }]
]

describe('basic ssr with relative path', () => {
  tests.forEach(([name, options]) => test(name, async () => {
    const config = await loadFixture('basic', options)
    nuxt = new Nuxt(config)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, 'localhost')

    const { html } = await nuxt.server.renderRoute('/')

    expect(html).toContain('<img src="./_nuxt/img')
    const { 1: imageSrc } = html.match(/<img src="\.(\/_nuxt\/img[^"]*)"/)

    const { statusCode } = await rp(url(imageSrc))
    expect(statusCode).toBe(200)

    await nuxt.close()
  }
  ))
})
