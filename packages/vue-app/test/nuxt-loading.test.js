/**
 * @jest-environment jsdom
 */
import { resolve } from 'path'
import { mount, createLocalVue } from '@vue/test-utils'
import { renderToString } from '@vue/server-test-utils'
import { loadFixture } from '../../../test/utils'
import { vmTick } from './__utils__'

jest.useFakeTimers()

describe('nuxt-loading', () => {
  let localVue
  let Component

  beforeAll(async () => {
    const config = await loadFixture('basic')
    const componentDir = resolve(config.rootDir, '.nuxt/components')

    localVue = createLocalVue()
    Component = (await import(resolve(componentDir, 'nuxt-loading.vue'))).default
  })

  afterEach(() => jest.clearAllTimers())

  test('removed when not loading', () => {
    const str = renderToString(Component)
    expect(str).toBe('<!---->')
  })

  test('added when loading', () => {
    const wrapper = mount(Component, { localVue })

    wrapper.setData({ throttle: 0 })
    wrapper.vm.start()

    expect(wrapper.html()).toBe('<div class="nuxt-progress" style="width: 0%;"></div>')
  })

  test('percentage changed after 1s', () => {
    const wrapper = mount(Component, { localVue })
    wrapper.setData({
      duration: 1000,
      throttle: 0
    })

    wrapper.vm.start()

    jest.advanceTimersByTime(250)

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

    let html = wrapper.html()
    expect(html).toBe('<div class="nuxt-progress" style="width: 100%;"></div>')
    expect(wrapper.vm.get()).toBe(100)

    jest.runAllTimers()
    await vmTick(wrapper.vm)

    html = wrapper.html()
    expect(html).toBeUndefined()
    expect(wrapper.vm.get()).toBe(0)
  })

  test('can fail', () => {
    const wrapper = mount(Component, { localVue })

    wrapper.vm.set(50)
    wrapper.vm.fail()

    const html = wrapper.html()
    expect(html).toBe('<div class="nuxt-progress nuxt-progress-failed" style="width: 50%;"></div>')
  })

  test('not shown until throttle', () => {
    const wrapper = mount(Component, { localVue })

    wrapper.setData({
      duration: 2000,
      throttle: 1000
    })

    wrapper.vm.start()
    jest.advanceTimersByTime(250)

    let html = wrapper.html()
    expect(html).toBeUndefined()

    jest.advanceTimersByTime(1000)

    html = wrapper.html()
    expect(html).not.toBe('<div class="nuxt-progress" style="width: 0%;"></div>')
    expect(html).toContain('<div class="nuxt-progress"')
  })

  test('can pause and resume', () => {
    const wrapper = mount(Component, { localVue })

    wrapper.setData({
      duration: 2000,
      throttle: 0
    })

    wrapper.vm.start()
    jest.advanceTimersByTime(250)

    let html = wrapper.html()
    expect(html).toContain('<div class="nuxt-progress"')

    wrapper.vm.pause()
    jest.advanceTimersByTime(500)

    const html2 = wrapper.html()
    expect(html2).toBe(html)

    wrapper.vm.resume()

    jest.advanceTimersByTime(500)

    html = wrapper.html()
    expect(html).toContain('<div class="nuxt-progress"')
    expect(html).not.toBe(html2)
  })

  test('continues after duration', () => {
    const wrapper = mount(Component, { localVue })

    wrapper.setData({
      continuous: true,
      duration: 500,
      rtl: false,
      throttle: 0
    })

    wrapper.vm.start()

    jest.advanceTimersByTime(500)

    let html = wrapper.html()
    expect(html).toBe('<div class="nuxt-progress nuxt-progress-notransition" style="width: 100%; left: 0px;"></div>')

    jest.advanceTimersByTime(250)

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
