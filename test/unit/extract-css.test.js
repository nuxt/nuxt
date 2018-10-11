import { resolve } from 'path'
import fs from 'fs'
import { promisify } from 'util'
import { loadFixture, getPort, Nuxt } from '../utils'

let nuxt = null
const readFile = promisify(fs.readFile)

describe('extract css', () => {
  beforeAll(async () => {
    const options = await loadFixture('extract-css')
    nuxt = new Nuxt(options)
    await nuxt.listen(await getPort(), '0.0.0.0')
  })

  test('Verify global.css has been extracted and minified', async () => {
    const extractedIndexCss = resolve(__dirname, '..', 'fixtures/extract-css/.nuxt/dist/client/pages_index.css')
    const content = await readFile(extractedIndexCss, 'utf-8')

    const scopeCss = /^h1\[data-v-[a-zA-Z0-9]{8}\]\{color:red\}\.container\[data-v-[a-zA-Z0-9]{8}\]/
    expect(content).toMatch(scopeCss)

    const containerStyle = '{display:-ms-grid;display:grid;-ms-grid-columns:60px 60px 60px 60px 60px;grid-template-columns:60px 60px 60px 60px 60px;-ms-grid-rows:30px 30px;grid-template-rows:30px 30px;grid-auto-flow:row}'
    expect(content).toContain(containerStyle)
  })

  test('/about should contain module style', async () => {
    const { html } = await nuxt.renderRoute('/about')
    expect(html).toMatch(/<h1 class="test_[a-zA-Z0-9]{5}">I'm BLUE<\/h1>/)
  })
})
