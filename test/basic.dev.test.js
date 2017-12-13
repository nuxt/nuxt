import test from 'ava'
import { resolve } from 'path'
import stdMocks from 'std-mocks'
// import rp from 'request-promise-native'
import { Nuxt, Builder, Utils } from '..'
import { truncateSync, readFileSync, writeFileSync } from 'fs'

const port = 4001
const url = (route) => 'http://localhost:' + port + route
const rootDir = resolve(__dirname, 'fixtures/basic')
const pluginPath = resolve(rootDir, 'plugins', 'watch.js')
const pluginContent = readFileSync(pluginPath)

let nuxt = null

// Init nuxt.js and create server listening on localhost:4000
test.before('Init Nuxt.js', async t => {
  const options = {
    rootDir,
    dev: true,
    profile: true,
    plugins: [
      '~/plugins/watch.js'
    ]
  }
  nuxt = new Nuxt(options)
  await new Builder(nuxt).build()

  await nuxt.listen(port, 'localhost')
})

test('remove mixins in live reloading', async t => {
  stdMocks.use()
  await nuxt.renderRoute(url('/'))
  t.true(stdMocks.flush().stdout.some(v => v === 'I am mixin\n'))

  truncateSync(pluginPath)
  await new Promise(async (resolve, reject) => {
    let waitTimes = 0
    while (!stdMocks.flush().stdout.some(v => ~v.indexOf('Compiled successfully'))) {
      await Utils.waitFor(100) && waitTimes++
      if (waitTimes === 20) {
        reject(Error('Dev server doesn\'t reload after 2000ms'))
      }
    }
    resolve()
  })

  await nuxt.renderRoute(url('/'))
  t.false(stdMocks.flush().stdout.some(v => v === 'I am mixin\n'))

  stdMocks.restore()
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
  writeFileSync(pluginPath, pluginContent)
  await nuxt.close()
})
