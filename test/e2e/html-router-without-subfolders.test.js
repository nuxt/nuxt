import path from 'path'
import express from 'express'
import Browser from '../utils/browser'
import { loadFixture, getPort, Nuxt, Generator, Builder, BundleBuilder } from '../utils'

let port
const browser = new Browser()
const url = route => 'http://localhost:' + port + route

let nuxt = null
let page = null
let server = null

describe('html router without subfolders', () => {
  beforeAll(async () => {
    const config = await loadFixture('html-router-without-subfolders')
    nuxt = new Nuxt(config)
    await nuxt.ready()
    const builder = new Builder(nuxt, BundleBuilder)
    const generator = new Generator(nuxt, builder)
    await generator.generate({ build: false })
    server = express()
    port = await getPort()
    server.use(express.static(path.resolve(nuxt.options.srcDir, 'dist')))
    server.listen(port)
    await browser.start()
  })

  test('/', async () => {
    page = await browser.page(url('/'))

    expect(await page.$text('h1')).toBe('mounted')
  })

  test('/index.html', async () => {
    page = await browser.page(url('/index.html'))

    expect(await page.$text('h1')).toBe('mounted')
  })

  test('/foo.html', async () => {
    page = await browser.page(url('/foo.html'))

    expect(await page.$text('h1')).toBe('mounted')
  })

  test('/foo/bar.html', async () => {
    page = await browser.page(url('/foo/bar.html'))

    expect(await page.$text('h1')).toBe('mounted')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
    server.close()
  })

  // Stop browser
  afterAll(async () => {
    await page.close()
    await browser.close()
  })
})
