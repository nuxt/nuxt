import test from 'ava'
import { resolve } from 'path'
import { Nuxt, Builder, Utils } from '..'
import { uniq } from 'lodash'
import rp from 'request-promise-native'

const port = 4008
let nuxt = null

// Utils
const range = n => [...Array(n).keys()]
const FOOBAR_REGEX = /<foobar>([\s\S]*)<\/foobar>/
const match = (regex, text) => (regex.exec(text) || [])[1]

const url = (route) => 'http://localhost:' + port + route

const isWindows = /^win/.test(process.platform)

// Init nuxt.js and create server listening on localhost:4000
test.before('Init Nuxt.js', async t => {
  const options = {
    rootDir: resolve(__dirname, 'fixtures/ssr'),
    dev: false,
    render: {
      resourceHints: false
    },
    build: {
      extractCSS: true
    }
  }
  nuxt = new Nuxt(options)
  await new Builder(nuxt).build()
  await nuxt.listen(port, 'localhost')
})

// == Uniq Test ==
// The idea behind is pages using a shared nextId() which returns an incrementing id
// So all responses should strictly be different and length of unique responses should equal to responses
// We strictly compare <foorbar>{id}</foorbar> section
// Because other response parts such as window.__NUXT may be different resulting false positive passes.
const uniqueTest = async (t, url) => {
  let results = []

  await Utils.parallel(range(20), async () => {
    let { html } = await nuxt.renderRoute(url)
    let foobar = match(FOOBAR_REGEX, html)
    results.push(parseInt(foobar))
  })

  let isUnique = uniq(results).length === results.length

  if (!isUnique) {
    /* eslint-disable no-console */
    console.log(url + '\n' + results.join(', ') + '\n')
  }

  t.true(isUnique)

  return results
}

test('unique responses with data()', async t => {
  await uniqueTest(t, '/data')
})

test('unique responses with component', async t => {
  await uniqueTest(t, '/component')
})

test('unique responses with async components', async t => {
  await uniqueTest(t, '/asyncComponent')
})

test('unique responses with asyncData()', async t => {
  await uniqueTest(t, '/asyncData')
})

test('unique responses with store initial state', async t => {
  await uniqueTest(t, '/store')
})

test('unique responses with nuxtServerInit', async t => {
  await uniqueTest(t, '/store?onServerInit=1')
})

test('unique responses with fetch', async t => {
  await uniqueTest(t, '/fetch')
})

// == Stress Test ==
// The idea of this test is to ensure there is no memory or data leak during SSR requests
// Or pending promises/sockets and function calls.
// Making 16K requests by default
// Related issue: https://github.com/nuxt/nuxt.js/issues/1354
const stressTest = async (t, _url, concurrency = 64, steps = 256) => {
  let statusCodes = { }

  // appveyor memory limit!
  if (isWindows) {
    concurrency = 1
    steps = 1
  }

  await Utils.sequence(range(steps), async () => {
    await Utils.parallel(range(concurrency), async () => {
      let response = await rp(url(_url), { resolveWithFullResponse: true })
      // Status Code
      let code = response.statusCode
      if (!statusCodes[code]) {
        statusCodes[code] = 0
      }
      statusCodes[code]++
    })
  })

  t.is(statusCodes[200], concurrency * steps)
}

test('stress test with asyncData', async t => {
  await stressTest(t, '/asyncData')
})

// Close server and ask nuxt to stop listening to file changes
test.after('Closing server and nuxt.js', t => {
  nuxt.close()
})
