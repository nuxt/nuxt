import { resolve } from 'path'
import { Nuxt, Builder } from '..'

const port = 4001
const url = route => 'http://localhost:' + port + route
const rootDir = resolve(__dirname, 'fixtures/basic')

let nuxt = null

describe('basic dev', () => {
  // Init nuxt.js and create server listening on localhost:4000
  beforeAll(async () => {
    const options = {
      rootDir,
      buildDir: '.nuxt-dev',
      dev: true,
      build: {
        stats: false,
        profile: true,
        extractCSS: {
          allChunks: true
        }
      }
    }

    nuxt = new Nuxt(options)
    new Builder(nuxt).build()
    await nuxt.listen(port, 'localhost')
  }, 30000)

  // TODO: enable test when style-loader.js:60 was resolved
  // test.serial('/extractCSS', async t => {
  //   const window = await nuxt.renderAndGetWindow(url('/extractCSS'))
  //   const html = window.document.head.innerHTML
  //   t.true(html.includes('vendor.css'))
  //   t.true(!html.includes('30px'))
  //   t.is(window.getComputedStyle(window.document.body).getPropertyValue('font-size'), '30px')
  // })

  test('/stateless', async () => {
    // const spies = await intercept()
    const window = await nuxt.renderAndGetWindow(url('/stateless'))
    const html = window.document.body.innerHTML
    expect(html.includes('<h1>My component!</h1>')).toBe(true)
    // expect(spies.info.calledWithMatch('You are running Vue in development mode.')).toBe(true)
    // release()
  })

  // test('/_nuxt/test.hot-update.json should returns empty html', async t => {
  //   try {
  //     await rp(url('/_nuxt/test.hot-update.json'))
  //   } catch (err) {
  //     t.is(err.statusCode, 404)
  //     t.is(err.response.body, '')
  //   }
  // })

  // Close server and ask nuxt to stop listening to file changes
  test('Closing server and nuxt.js', async () => {
    await nuxt.close()
  })
})
