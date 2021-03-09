import { loadFixture, getPort, Nuxt, rp, Builder } from '../utils'

let port
let nuxt
const url = route => 'http://localhost:' + port + route

async function expectedBehavior () {
  const { html } = await nuxt.server.renderRoute('/')

  expect(html).toContain('<img src="./_nuxt/img')
  const { 1: imageSrc } = html.match(/<img src="\.(\/_nuxt\/img[^"]*)"/)

  const { statusCode } = await rp(url(imageSrc))
  expect(statusCode).toBe(200)
}

describe('basic ssr with relative path', () => {
  test('relative publicPath can be used in dev ssr', async () => {
    const config = await loadFixture('basic', {
      build: {
        publicPath: './_nuxt/'
      }
    })
    nuxt = new Nuxt(config)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, 'localhost')

    await expectedBehavior()

    await nuxt.close()
  })

  test('relative publicPath can be used in production ssr', async () => {
    const config = await loadFixture('basic', {
      dev: false,
      build: {
        publicPath: './_nuxt/'
      }
    })
    nuxt = new Nuxt(config)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, 'localhost')

    await expectedBehavior()

    await nuxt.close()
  })
})
