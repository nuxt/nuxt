import { normalize } from 'path'
import consola from 'consola'
import { loadFixture, getPort, Nuxt, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

let nuxt = null
// let buildSpies = null

describe('module', () => {
  beforeAll(async () => {
    const config = await loadFixture('module')
    nuxt = new Nuxt(config)
    port = await getPort()
    await nuxt.listen(port, 'localhost')
  })

  test('Plugin', async () => {
    expect(normalize(nuxt.options.plugins[0].src).includes(
      normalize('fixtures/module/.nuxt/basic.reverse.')
    )).toBe(true)
    const { html } = await nuxt.renderRoute('/')
    expect(html.includes('<h1>TXUN</h1>')).toBe(true)
  })

  test('Layout', async () => {
    expect(nuxt.options.layouts.layout.includes('layout')).toBe(true)

    const { html } = await nuxt.renderRoute('/layout')
    expect(html.includes('<h1>Module Layouts</h1>')).toBe(true)
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
    const response = await rp(url('/api'))
    expect(response).toBe('It works!')
  })

  test('Hooks - Use external middleware before render', async () => {
    const response = await rp(url('/use-middleware'))
    expect(response).toBe('Use external middleware')
  })

  test('Hooks - render context', async () => {
    await nuxt.renderRoute('/render-context')
    expect(nuxt.__render_context).toBeTruthy()
  })

  test('AddVendor - deprecated', () => {
    nuxt.moduleContainer.addVendor('nuxt-test')
    expect(consola.warn).toHaveBeenCalledWith('addVendor has been deprecated due to webpack4 optimization')
  })

  // Close server and ask nuxt to stop listening to file changes
  afterAll(async () => {
    await nuxt.close()
  })
})
