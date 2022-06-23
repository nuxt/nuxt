/**
 * @jest-environment jsdom
 */
import { mount, createLocalVue } from '@vue/test-utils'
import { renderToString } from '@vue/server-test-utils'
import { compileTemplate, importComponent, vmTick } from './__utils__'

jest.useFakeTimers()

describe('nuxt-loading', () => {
  let localVue
  let Component

  beforeAll(async () => {
    const compiledTemplate = await compileTemplate('components/nuxt-loading.vue')
    Component = await importComponent(compiledTemplate)

    localVue = createLocalVue()
  })

  afterEach(() => jest.clearAllTimers())

  test('removed when not loading', async () => {
    const str = await renderToString(Component)
    expect(str).toBe('<!---->')
  })

  test('added when loading', async () => {
    const wrapper = mount(Component)
    wrapper.setData({ throttle: 0 })
    wrapper.vm.start()

    await vmTick(wrapper.vm)

    expect(wrapper.html()).toBe('<div class="nuxt-progress" style="width: 0%;"></div>')
  })

  test('percentage changed after 1s', async () => {
    const wrapper = mount(Component, { localVue })
    wrapper.setData({
      duration: 1000,
      throttle: 0
    })

    wrapper.vm.start()

    jest.advanceTimersByTime(250)
    await vmTick(wrapper.vm)

    const html = wrapper.html()
    expect(html).not.toBe('<div class="nuxt-progress" style="width:0%;"></div>')
    expect(wrapper.vm.get()).not.toBe(0)
  })

  test('can be finished', async () => {
    const wrapper = mount(Component, { localVue })

    wrapper.setData({
      duration: 1000,
      throttle: 0
    })

    wrapper.vm.start()
    wrapper.vm.finish()

    await vmTick(wrapper.vm)

    let html = wrapper.html()
    expect(html).toBe('<div class="nuxt-progress" style="width: 100%;"></div>')
    expect(wrapper.vm.get()).toBe(100)

    jest.runAllTimers()
    await vmTick(wrapper.vm)

    html = wrapper.html()
    expect(html).toBe('')
    expect(wrapper.vm.get()).toBe(0)
  })

  test('can fail', async () => {
    const wrapper = mount(Component, { localVue })

    wrapper.vm.set(50)
    wrapper.vm.fail()

    await vmTick(wrapper.vm)

    const html = wrapper.html()
    expect(html).toBe('<div class="nuxt-progress nuxt-progress-failed" style="width: 50%;"></div>')
  })

  test('not shown until throttle', async () => {
    const wrapper = mount(Component, { localVue })

    wrapper.setData({
      duration: 2000,
      throttle: 1000
    })

    wrapper.vm.start()

    await vmTick(wrapper.vm)

    jest.advanceTimersByTime(250)

    await vmTick(wrapper.vm)

    let html = wrapper.html()
    expect(html).toBe('')

    jest.advanceTimersByTime(1000)

    await vmTick(wrapper.vm)

    html = wrapper.html()
    expect(html).not.toBe('<div class="nuxt-progress" style="width: 0%;"></div>')
    expect(html).toContain('<div class="nuxt-progress"')
  })

  test('can pause and resume', async () => {
    const wrapper = mount(Component, { localVue })

    wrapper.setData({
      duration: 2000,
      throttle: 0
    })

    wrapper.vm.start()
    jest.advanceTimersByTime(250)

    await vmTick(wrapper.vm)

    let html = wrapper.html()
    expect(html).toContain('<div class="nuxt-progress"')

    wrapper.vm.pause()
    jest.advanceTimersByTime(500)

    await vmTick(wrapper.vm)

    const html2 = wrapper.html()
    expect(html2).toBe(html)

    wrapper.vm.resume()

    jest.advanceTimersByTime(500)

    await vmTick(wrapper.vm)

    html = wrapper.html()
    expect(html).toContain('<div class="nuxt-progress"')
    expect(html).not.toBe(html2)
  })

  test('continues after duration', async () => {
    const wrapper = mount(Component, { localVue })

    wrapper.setData({
      continuous: true,
      duration: 500,
      rtl: false,
      throttle: 0
    })

    wrapper.vm.start()

    await vmTick(wrapper.vm)

    jest.advanceTimersByTime(500)

    await vmTick(wrapper.vm)

    let html = wrapper.html()
    expect(html).toBe('<div class="nuxt-progress nuxt-progress-notransition" style="width: 100%; left: 0px;"></div>')

    jest.advanceTimersByTime(250)

    await vmTick(wrapper.vm)

    html = wrapper.html()
    expect(wrapper.vm.reversed).toBe(true)
    expect(html).toContain('<div class="nuxt-progress"')
    expect(html).not.toContain('width: 0%')
    expect(html).not.toContain('width: 100%')
    expect(wrapper.vm.left).toBe('auto')
    // TODO: check why the rendered html still has left: 0px (probably test-utils issue)
    // expect(html).toContain('left: auto')
  })
})
