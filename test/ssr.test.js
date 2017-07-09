import test from 'ava'
import { resolve } from 'path'
import { Nuxt, Builder, Utils } from '..'
import { uniq } from 'lodash'

const port = 4008
let nuxt = null

// Utils
const range = n => [...Array(n).keys()]
const FOOBAR_REGEX = /<foobar>([\s\S]*)<\/foobar>/
const match = (regex, text) => (regex.exec(text) || [])[1]

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
// The idea behind is pages using a shared nextId() which retuns an increamenting id
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

test.todo('unique responses with async components (wait Vue 2.4)')
// test('unique responses with async components', async t => {
//   await uniqueTest(t, '/asyncComponent')
// })

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

// Close server and ask nuxt to stop listening to file changes
test.after('Closing server and nuxt.js', t => {
  nuxt.close()
})
