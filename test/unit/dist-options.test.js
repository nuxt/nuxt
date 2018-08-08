import { loadFixture, getPort, Nuxt, Builder, rp } from '../utils'
import { writeFile } from 'fs-extra'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null
let transpile = null

describe('dist options', () => {
  beforeAll(async () => {
    const options = loadFixture('basic')
    nuxt = new Nuxt(Object.assign(options, {dev: false}))
    port = await getPort()
    await nuxt.listen(port, '0.0.0.0')
  })

  test('/body.js', async () => {
    const { statusCode, body, headers } = await rp(
      url('/body.js'),
      { resolveWithFullResponse: true }
    )
    await writeFile('/tmp/debug123', JSON.stringify(headers))
    expect(headers['x-custom']).toBe('custom header')
    expect(statusCode).toBe('200')
    expect(body.includes('Body script!')).toBe(true)
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
