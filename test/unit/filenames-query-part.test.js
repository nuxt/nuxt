import { resolve } from 'path'
import { existsSync, readFileSync } from 'fs'
import { getPort, loadFixture, Nuxt } from '../utils'

let port

let nuxt = null

expect.extend({
  toFileExist (file) {
    if (existsSync(file)) {
      return {
        message: () => `expected '${file}' not exist`,
        pass: true
      }
    } else {
      return {
        message: () => `expected '${file}' exist`,
        pass: false
      }
    }
  }
})

describe('build filenames with query part', () => {
  beforeAll(async () => {
    const config = await loadFixture('filenames-query-part')
    nuxt = new Nuxt(config)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
  })

  test('server manifest files exist', () => {
    const manifest = JSON.parse(readFileSync(resolve(__dirname, '..', 'fixtures/filenames-query-part/.nuxt/dist/server/server.manifest.json'), 'utf8'))
    expect(manifest).toMatchObject({
      files: expect.any(Object)
    })
    for (const file in manifest.files) {
      expect(resolve(__dirname, '..', `fixtures/filenames-query-part/.nuxt/dist/server/${manifest.files[file]}`)).toFileExist()
    }
  })

  test("render / without error 'Cannot find module'", async () => {
    await expect(nuxt.server.renderRoute('/')).resolves.toMatchObject({
      html: expect.stringContaining('<h1>Chunks with version in query part</h1>')
    })
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
