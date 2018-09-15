import { resolve } from 'path'
import fs from 'fs'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)

describe('extract css', () => {
  test('Verify global.css has been extracted and minified', async () => {
    const pathToMinifiedGlobalCss = resolve(__dirname, '..', 'fixtures/extract-css/.nuxt/dist/client/754d16f1908d2d48eddd.css')
    const content = await readFile(pathToMinifiedGlobalCss, 'utf-8')
    const expectedContent = 'h1[data-v-180e2718]{color:red}.container[data-v-180e2718]{-ms-grid-columns:60px 60px 60px 60px 60px;-ms-grid-rows:30px 30px;display:-ms-grid;display:grid;grid-auto-flow:row;grid-template-columns:60px 60px 60px 60px 60px;grid-template-rows:30px 30px}'
    expect(content).toBe(expectedContent)
  })
})
