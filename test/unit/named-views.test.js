import { getPort, loadFixture, Nuxt } from '../utils'

let port
let nuxt = null

describe('named views', () => {
  beforeAll(async () => {
    const options = await loadFixture('named-views')
    nuxt = new Nuxt(options)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, '0.0.0.0')
  })

  test('/ - no child, no named', async () => {
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('LEFT:<!---->:LEFT')
    expect(html).toContain('CHILD:<!---->:CHILD')
    expect(html).toContain('TOP:<!---->:TOP')
  })

  test('/section - have child, no named', async () => {
    const { html } = await nuxt.server.renderRoute('/section')
    expect(html).toContain('LEFT:<!---->:LEFT')
    expect(html).toMatch(new RegExp('CHILD:<div( data-v-.+)*>This page does not have left panel.</div>:CHILD'))
    expect(html).toContain('TOP:<!---->:TOP')
  })

  test('/child/123 - have child, have named', async () => {
    const { html } = await nuxt.server.renderRoute('/child/123')
    expect(html).toMatch(new RegExp('LEFT:<div( data-v-.+)*>Child Left content!</div>:LEFT'))
    expect(html).toMatch(new RegExp('CHILD:<div( data-v-.+)*>Child content ID:123!</div>:CHILD'))
    expect(html).toContain('TOP:<!---->:TOP')
  })

  test('/main - no child, no named left, have named top', async () => {
    const { html } = await nuxt.server.renderRoute('/main')
    expect(html).toMatch(new RegExp('TOP:<div( data-v-.+)*>Main Top content!</div>:TOP'))
    expect(html).toContain('LEFT:<!---->:LEFT')
    expect(html).toContain('CHILD:<!---->:CHILD')
  })
})
