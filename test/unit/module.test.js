import { normalize, resolve } from 'path'
import consola from 'consola'
import { loadFixture, getPort, Nuxt, Builder, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + route
const rootDir = resolve(__dirname, '..', 'fixtures/module')

let nuxt = null
// let buildSpies = null

describe('module', () => {
  beforeAll(async () => {
    const config = await loadFixture('module')
    nuxt = new Nuxt(config)
    await nuxt.ready()

    port = await getPort()
    await nuxt.server.listen(port, 'localhost')
  })

  test('Plugin', async () => {
    expect(normalize(nuxt.options.plugins[0].src).includes(
      normalize('fixtures/module/.nuxt/basic.reverse.')
    )).toBe(true)
    const { html } = await nuxt.server.renderRoute('/')
    expect(html).toContain('<h1>TXUN</h1>')
  })

  test('Layout - layouts from Module.addLayout take precedence', async () => {
    expect(nuxt.options.layouts.layout).toContain('layout')

    const { html } = await nuxt.server.renderRoute('/layout')
    expect(html).toContain('<h1>Module Layouts</h1>')
  })

  test('/404 should display the module error layout', async () => {
    const { html } = await nuxt.server.renderRoute('/404')
    expect(html).toContain('You should see the error in a different Vue!')
  })

  test('Hooks', () => {
    expect(nuxt.__module_hook).toBe(1)
    expect(nuxt.__renderer_hook).toBe(2)
  })

  test('Hooks - Functional', () => {
    expect(nuxt.__ready_called__).toBe(true)
  })

  // test('Hooks - Error', async () => {
  //   expect(buildSpies.error.calledWithMatch(/build:extendRoutes/)).toBe(true)
  // })

  test('Middleware', async () => {
    const { body: response } = await rp(url('/api'))
    expect(response).toBe('It works!')
  })

  test('serverMiddleware with path', async () => {
    const { body: response } = await rp(url('/midd3'))
    expect(response).toBe('Be creative when writing test strings! Hey Mama :wave:')
  })

  test('Hooks - Use external middleware before render', async () => {
    const { body: response } = await rp(url('/use-middleware'))
    expect(response).toBe('Use external middleware')
  })

  test('Hooks - render context', async () => {
    await nuxt.server.renderRoute('/render-context')
    expect(nuxt.__render_context).toBeTruthy()
  })

  test('AddVendor - deprecated', () => {
    nuxt.moduleContainer.addVendor('nuxt-test')
    expect(consola.warn).toHaveBeenCalledWith('addVendor has been deprecated due to webpack4 optimization')
  })

  test('AddLayout - duplicate layout', () => {
    nuxt.moduleContainer.addLayout(resolve(rootDir, 'modules', 'basic', 'layout.vue'))
    expect(consola.warn).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate layout registration, "layout" has been registered as "./basic.layout.')
    )
  })

  test('Lodash - deprecated', async () => {
    const builder = new Builder(nuxt)
    await builder.generateRoutesAndFiles()
    expect(consola.warn).toHaveBeenCalledWith('Avoid using _ inside templates')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
