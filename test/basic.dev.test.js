import test from 'ava'
import { resolve } from 'path'
// import rp from 'request-promise-native'
import { Nuxt, Builder } from '../index.js'

const port = 4001
const url = (route) => 'http://localhost:' + port + route

let nuxt = null

// Init nuxt.js and create server listening on localhost:4000
test.before('Init Nuxt.js', async t => {
  const options = {
    rootDir: resolve(__dirname, 'fixtures/basic'),
    dev: true
  }
  nuxt = new Nuxt(options)
  await new Builder(nuxt).build()

  await nuxt.listen(port, 'localhost')
})

test('/stateless', async t => {
  const window = await nuxt.renderAndGetWindow(url('/stateless'))
  const html = window.document.body.innerHTML
  t.true(html.includes('<h1>My component!</h1>'))
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
test.after('Closing server and nuxt.js', async t => {
  await nuxt.close()
})
