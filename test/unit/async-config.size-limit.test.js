import cheerio from 'cheerio'
import fetch from 'node-fetch'
import { getPort, loadFixture, Nuxt } from '../utils'

let port
let nuxt = null
const url = route => 'http://localhost:' + port + route

const getScriptsSize = async (html) => {
  // Get all script URLs from the HTML
  const $ = cheerio.load(html)
  const scriptsUrls = $('script[src]')
    .map((_, el) => $(el).attr('src'))
    .get()
    .map(url)
  const resourceUrls = [url('/'), ...scriptsUrls]

  // Fetch all resources and get their size (bytes)
  const responseSizes = await Promise.all(resourceUrls.map(async (url) => {
    const response = await fetch(url).then(res => res.text())
    return response.length
  }))

  const responseSizeBytes = responseSizes.reduce((bytes, responseLength) => bytes + responseLength, 0)
  const responseSizeKilobytes = Math.ceil(responseSizeBytes / 1024)
  return responseSizeKilobytes
}

describe('size-limit test', () => {
  beforeAll(async () => {
    const options = await loadFixture('async-config')
    nuxt = new Nuxt(options)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, '0.0.0.0')
  })

  it('should stay within the size boundaries in legacy mode', async () => {
    // Without gzip!
    const { html } = await nuxt.server.renderRoute('/')
    const legacySizeKilobytes = await getScriptsSize(html)
    expect(legacySizeKilobytes).toBeLessThanOrEqual(196)
  })

  it('should stay within the size boundaries in modern mode', async () => {
    // Without gzip!
    const { html } = await nuxt.server.renderRoute('/', { modern: true, res: { setHeader: () => {} } })
    const modernSizeKilobytes = await getScriptsSize(html)
    expect(modernSizeKilobytes).toBeLessThanOrEqual(174)
  })
})
