import { getPort, loadFixture, Nuxt } from '../utils'

let port
let nuxt = null

describe('module-error-layout', () => {
  beforeAll(async () => {
    const config = await loadFixture('module-error-layout')
    nuxt = new Nuxt(config)
    port = await getPort()
    await nuxt.listen(port, 'localhost')
  })

  test('/404 should display the module error layout', async () => {
    const { html } = await nuxt.renderRoute('/404')
    expect(html).toContain('You should see the error in a different Vue!')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
