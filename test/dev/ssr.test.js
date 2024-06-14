import { uniq } from 'lodash'
import { loadFixture, getPort, Nuxt, rp, sequence, parallel } from '../utils'

let port
let nuxt = null

// Utils
const range = n => [...Array(n).keys()]
const FOOBAR_REGEX = /<Foobar>([\s\S]*)<\/Foobar>/
const match = (regex, text) => (regex.exec(text) || [])[1]

const url = route => 'http://127.0.0.1:' + port + route

// const isWindows = /^win/.test(process.platform)

// == Uniq Test ==
// The idea behind is pages using a shared nextId() which returns an incrementing id
// So all responses should strictly be different and length of unique responses should equal to responses
// We strictly compare <Foobar>{id}</Foobar> section
// Because other response parts such as window.__NUXT may be different resulting false positive passes.
const uniqueTest = async (url) => {
  const results = []

  await parallel(range(5), async () => {
    const { html } = await nuxt.server.renderRoute(url)
    const foobar = match(FOOBAR_REGEX, html)
    results.push(parseInt(foobar))
  })

  const isUnique = uniq(results).length === results.length

  if (!isUnique) {
    /* eslint-disable no-console */
    console.log(url + '\n' + results.join(', ') + '\n')
  }

  expect(isUnique).toBe(true)

  return results
}

// == Stress Test ==
// The idea of this test is to ensure there is no memory or data leak during SSR requests
// Or pending promises/sockets and function calls.
// Related issue: https://github.com/nuxt/nuxt.js/issues/1354
const stressTest = async (_url, concurrency = 2, steps = 4) => {
  const statusCodes = {}

  await sequence(range(steps), async () => {
    await parallel(range(concurrency), async () => {
      const response = await rp(url(_url))
      // Status Code
      const code = response.statusCode
      if (!statusCodes[code]) {
        statusCodes[code] = 0
      }
      statusCodes[code]++
    })
  })

  expect(statusCodes[200]).toBe(concurrency * steps)
}

describe('ssr', () => {
  beforeAll(async () => {
    const config = await loadFixture('ssr')
    nuxt = new Nuxt(config)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, '127.0.0.1')
  })

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

  test('store undefined variable response', async () => {
    const window = await nuxt.server.renderAndGetWindow(url('/store'))
    expect('idUndefined' in window.__NUXT__.state).toBe(true)
    expect(window.__NUXT__.state.idUndefined).toEqual(undefined)
  })

  test('stress test with asyncData', async () => {
    await stressTest('/asyncData')
  })

  test('does not share state', async () => {
    const [page1, page2] = await Promise.all([
      nuxt.server.renderRoute('/context'),
      nuxt.server.renderRoute('/context/child')
    ])

    expect(page1.html).toContain('vm: /context')
    expect(page1.html).toContain('context: /context')

    expect(page2.html).toContain('vm: /context/child')
    expect(page2.html).toContain('context: /context/child')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
