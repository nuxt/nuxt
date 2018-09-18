import { resolve } from 'path'
import fs from 'fs'
import { promisify } from 'util'

const readDir = promisify(fs.readdir)

describe('extract css', () => {
  test('Verify global.css has been extracted and minified', async () => {
    expect.assertions(2)
    let cssFilesFound = 0
    
    const pathToDistClient = resolve(__dirname, '..', 'fixtures/extract-css/.nuxt/dist/client')
    const files = await readDir(pathToDistClient)
    files.forEach((fileName) => {
      if (fileName.endsWith('.css')) {
        cssFilesFound++
        const content = fs.readFileSync(resolve(pathToDistClient, fileName), 'utf-8')
        if (!content.includes('.__nuxt-error-page')) {
          const expectedContent = 'h1[data-v-180e2718]{color:red}.container[data-v-180e2718]{-ms-grid-columns:60px 60px 60px 60px 60px;-ms-grid-rows:30px 30px;display:-ms-grid;display:grid;grid-auto-flow:row;grid-template-columns:60px 60px 60px 60px 60px;grid-template-rows:30px 30px}'
          expect(content).toBe(expectedContent)
        }
      }
    })
    expect(cssFilesFound).toBe(2)
  })
})
