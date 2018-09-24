import { resolve } from 'path'
import { promisify } from 'util'
import Vue from 'vue'
import { loadFixture, Utils } from '../utils'

const renderer = require('vue-server-renderer').createRenderer()
const renderToString = promisify(renderer.renderToString)

let componentDir

describe('components', () => {
  beforeAll(async () => {
    const config = await loadFixture('basic')
    componentDir = resolve(config.rootDir, '.nuxt/components')
  })

  describe('nuxt-loading', () => {
    let VueComponent

    beforeAll(async () => {
      const Component = (await import(resolve(componentDir, 'nuxt-loading.vue'))).default
      VueComponent = Vue.extend(Component)
    })

    test('removed when not loading', async () => {
      const component = new VueComponent().$mount()
      const str = await renderToString(component)
      expect(str).toBe('<!---->')
    })

    test('added when loading', async () => {
      const component = new VueComponent().$mount()
      component.throttle = 0
      component.start()
      const str = await renderToString(component)
      expect(str).toBe('<div data-server-rendered="true" class="nuxt-progress" style="width:0%;left:false;"></div>')
      component.clear()
    })

    test('percentage changed after 1s', async () => {
      jest.useRealTimers()
      const component = new VueComponent().$mount()
      component.duration = 2000
      component.throttle = 0
      component.start()
      await Utils.waitFor(250)
      const str = await renderToString(component)
      expect(str).not.toBe('<!---->')
      expect(str).not.toBe('<div data-server-rendered="true" class="nuxt-progress" style="width:0%;left:false;"></div>')
      expect(component.$data.percent).not.toBe(0)
      component.clear()
    })

    test('percentage can be set with 1 decimal precision', async () => {
      const component = new VueComponent().$mount()
      component.set(50.5)
      const str = await renderToString(component)
      expect(str).toBe('<div data-server-rendered="true" class="nuxt-progress" style="width:50.5%;left:false;"></div>')
      expect(component.$data.percent).toBe(50.5)
    })

    test('can be finished', async () => {
      jest.useFakeTimers()
      const component = new VueComponent().$mount()
      component.throttle = 0
      component.start()
      component.finish()
      let str = await renderToString(component)
      expect(str).toBe('<div data-server-rendered="true" class="nuxt-progress" style="width:100%;left:false;"></div>')
      expect(component.$data.percent).toBe(100)
      jest.runAllTimers()
      str = await renderToString(component)
      expect(str).toBe('<!---->')
      expect(component.$data.percent).toBe(0)
      component.clear()
      jest.useRealTimers()
    })

    test('can fail', async () => {
      const component = new VueComponent().$mount()
      component.set(50)
      component.fail()
      const str = await renderToString(component)
      expect(str).toBe('<div data-server-rendered="true" class="nuxt-progress nuxt-progress-failed" style="width:50%;left:false;"></div>')
    })

    test('not shown until throttle', async () => {
      const component = new VueComponent().$mount()
      component.duration = 2000
      component.throttle = 1000
      component.start()
      await Utils.waitFor(300)
      let str = await renderToString(component)
      expect(str).toBe('<!---->')
      await Utils.waitFor(1000)
      str = await renderToString(component)
      expect(str).not.toBe('<!---->')
      expect(str).not.toBe('<div data-server-rendered="true" class="nuxt-progress" style="width:0%;left:false;"></div>')
      component.clear()
    })

    test('can pause and resume', async () => {
      const component = new VueComponent().$mount()
      component.duration = 2000
      component.throttle = 0
      component.start()
      await Utils.waitFor(250)
      let str = await renderToString(component)
      expect(str).not.toBe('<!---->')
      component.pause()
      await Utils.waitFor(500)
      const str2 = await renderToString(component)
      expect(str2).toBe(str)
      component.resume()
      await Utils.waitFor(500)
      str = await renderToString(component)
      expect(str).not.toBe('<!---->')
      expect(str).not.toBe(str2)
      component.clear()
    })

    test('continues after duration', async () => {
      const component = new VueComponent().$mount()
      component.continuous = true
      component.duration = 500
      component.throttle = 0
      component.start()
      await Utils.waitFor(750)
      const str = await renderToString(component)
      expect(str).not.toBe('<!---->')
      expect(str).not.toBe('<div data-server-rendered="true" class="nuxt-progress" style="width:100%;left:false;"></div>')
      expect(str).not.toBe('<div data-server-rendered="true" class="nuxt-progress" style="width:100%;left:auto;"></div>')
      expect(str).not.toBe('<div data-server-rendered="true" class="nuxt-progress nuxt-progress-notransition" style="width:100%;left:false;"></div>')
      expect(str).not.toBe('<div data-server-rendered="true" class="nuxt-progress nuxt-progress-notransition" style="width:100%;left:auto;"></div>')
      component.clear()
    })
  })
})
