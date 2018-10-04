import { resolve } from 'path'
import fs from 'fs'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)

describe('extract css', () => {
  // TODO: make css chunk name predictive
  test('Verify global.css has been extracted and minified', async () => {
    const pathToMinifiedGlobalCss = resolve(__dirname, '..', 'fixtures/extract-css/.nuxt/dist/client/a8f7dc125e9be1f8e379.css')
    const content = await readFile(pathToMinifiedGlobalCss, 'utf-8')
    const expectedContent = 'h1[data-v-63b6e918]{color:red}.container[data-v-63b6e918]{display:-ms-grid;display:grid;-ms-grid-columns:60px 60px 60px 60px 60px;grid-template-columns:60px 60px 60px 60px 60px;-ms-grid-rows:30px 30px;grid-template-rows:30px 30px;grid-auto-flow:row}'
    expect(content).toContain(expectedContent)
  })
})
