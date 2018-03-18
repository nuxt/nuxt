import { Nuxt, Builder, Utils } from '..'
import { uniq } from 'lodash'
import rp from 'request-promise-native'
import { loadConfig } from './helpers/config'

const port = 4008
let nuxt = null

// Utils
const range = n => [...Array(n).keys()]
const FOOBAR_REGEX = /<foobar>([\s\S]*)<\/foobar>/
const match = (regex, text) => (regex.exec(text) || [])[1]

const url = route => 'http://localhost:' + port + route

// const isWindows = /^win/.test(process.platform)

describe('ssr', () => {
  // Init nuxt.js and create server listening on localhost:4000
  beforeAll(async () => {
    const config = loadConfig('ssr')

    nuxt = new Nuxt(config)
    new Builder(nuxt).build()
    await nuxt.listen(port, 'localhost')
  }, 30000)

  // == Uniq Test ==
  // The idea behind is pages using a shared nextId() which returns an incrementing id
  // So all responses should strictly be different and length of unique responses should equal to responses
  // We strictly compare <foorbar>{id}</foorbar> section
  // Because other response parts such as window.__NUXT may be different resulting false positive passes.
  const uniqueTest = async (t, url) => {
    let results = []

    await Utils.parallel(range(5), async () => {
      let { html } = await nuxt.renderRoute(url)
      let foobar = match(FOOBAR_REGEX, html)
      results.push(parseInt(foobar))
    })

    let isUnique = uniq(results).length === results.length

    if (!isUnique) {
      /* eslint-disable no-console */
      console.log(url + '\n' + results.join(', ') + '\n')
    }

    expect(isUnique).toBe(true)

    return results
  }

  test('unique responses with data()', async () => {
    await uniqueTest('/data')
  })

  test('unique responses with component', async () => {
    await uniqueTest('/component')
  })

  test('unique responses with async components', async () => {
    await uniqueTest('/asyncComponent')
  })

  test('unique responses with asyncData()', async () => {
    await uniqueTest('/asyncData')
  })

  test('unique responses with store initial state', async () => {
    await uniqueTest('/store')
  })

  test('unique responses with nuxtServerInit', async () => {
    await uniqueTest('/store?onServerInit=1')
  })

  test('unique responses with fetch', async () => {
    await uniqueTest('/fetch')
  })

  // == Stress Test ==
  // The idea of this test is to ensure there is no memory or data leak during SSR requests
  // Or pending promises/sockets and function calls.
  // Related issue: https://github.com/nuxt/nuxt.js/issues/1354
  const stressTest = async (t, _url, concurrency = 2, steps = 4) => {
    let statusCodes = {}

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

    expect(statusCodes[200]).toBe(concurrency * steps)
  }

  test('stress test with asyncData', async () => {
    await stressTest('/asyncData')
  })

  // Close server and ask nuxt to stop listening to file changes
  test('Closing server and nuxt.js', async () => {
    await nuxt.close()
  })
})
