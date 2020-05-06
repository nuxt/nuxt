/**
 * @jest-environment jsdom
 */
import { mount, RouterLinkStub } from '@vue/test-utils'
import { vmTick, compileTemplate, importComponent } from './__utils__'

/* eslint-disable no-console */
describe('nuxt-link prefetch', () => {
  beforeAll(() => {
    jest.useFakeTimers()

    jest.spyOn(console, 'warn')
    jest.spyOn(console, 'error')
  })

  afterAll(() => jest.restoreAllMocks())

  test('when router.prefetchLinks is set to false, link with no prop should not be prefetched',
    async () => {
      const compiledTemplatePath = await compileTemplate(
        'components/nuxt-link.client.js',
        'nuxt-link.client.prefetch.0.js',
        { router: { prefetchLinks: false } }
      )

      const Component = await importComponent(compiledTemplatePath)
      const observe = jest.spyOn(Component.methods, 'observe')
      Component.extends = RouterLinkStub

      const wrapper = mount(Component, {
        propsData: { to: '/link' }
      })

      jest.runAllTimers()
      await vmTick(wrapper.vm)

      expect(console.warn).not.toHaveBeenCalled()
      expect(console.error).not.toHaveBeenCalled()

      expect(wrapper.props('prefetch')).toBe(false)
      expect(wrapper.props('noPrefetch')).toBe(false)
      expect(observe).not.toHaveBeenCalled()
    })

  test('when router.prefetchLinks is set to false, link with prefetch prop set to true should be prefetched',
    async () => {
      const compiledTemplatePath = await compileTemplate(
        'components/nuxt-link.client.js',
        'nuxt-link.client.prefetch.1.js',
        { router: { prefetchLinks: false } }
      )

      const Component = await importComponent(compiledTemplatePath)
      const observe = jest.spyOn(Component.methods, 'observe')
      Component.extends = RouterLinkStub

      const wrapper = mount(Component, {
        propsData: { to: '/link', prefetch: true }
      })

      jest.runAllTimers()
      await vmTick(wrapper.vm)

      expect(console.warn).not.toHaveBeenCalled()
      expect(console.error).not.toHaveBeenCalled()

      expect(wrapper.props('prefetch')).toBe(true)
      expect(wrapper.props('noPrefetch')).toBe(false)
      expect(observe).toHaveBeenCalled()
    })

  test('when router.prefetchLinks is set to true (default), link with no prop should be prefetched',
    async () => {
      const compiledTemplatePath = await compileTemplate(
        'components/nuxt-link.client.js',
        'nuxt-link.client.prefetch.2.js',
        {}
      )

      const Component = await importComponent(compiledTemplatePath)
      const observe = jest.spyOn(Component.methods, 'observe')
      Component.extends = RouterLinkStub

      const wrapper = mount(Component, {
        propsData: { to: '/link' }
      })

      jest.runAllTimers()
      await vmTick(wrapper.vm)

      expect(console.warn).not.toHaveBeenCalled()
      expect(console.error).not.toHaveBeenCalled()

      expect(wrapper.props('prefetch')).toBe(true)
      expect(wrapper.props('noPrefetch')).toBe(false)
      expect(observe).toHaveBeenCalled()
    })

  test('when router.prefetchLinks is set to true (default), link with prefetch prop set to false should not be prefetched',
    async () => {
      const compiledTemplatePath = await compileTemplate(
        'components/nuxt-link.client.js',
        'nuxt-link.client.prefetch.3.js',
        {}
      )

      const Component = await importComponent(compiledTemplatePath)
      const observe = jest.spyOn(Component.methods, 'observe')
      Component.extends = RouterLinkStub

      const wrapper = mount(Component, {
        propsData: { to: '/link', prefetch: false }
      })

      jest.runAllTimers()
      await vmTick(wrapper.vm)

      expect(console.warn).not.toHaveBeenCalled()
      expect(console.error).not.toHaveBeenCalled()

      expect(wrapper.props('prefetch')).toBe(false)
      expect(wrapper.props('noPrefetch')).toBe(false)
      expect(observe).not.toHaveBeenCalled()
    })

  test('when router.prefetchLinks is set to true (default), link with noPrefetch prop should not be prefetched',
    async () => {
      const compiledTemplatePath = await compileTemplate(
        'components/nuxt-link.client.js',
        'nuxt-link.client.prefetch.4.js',
        {}
      )

      const Component = await importComponent(compiledTemplatePath)
      const observe = jest.spyOn(Component.methods, 'observe')
      Component.extends = RouterLinkStub

      const wrapper = mount(Component, {
        propsData: { to: '/link', noPrefetch: true }
      })

      jest.runAllTimers()
      await vmTick(wrapper.vm)

      expect(console.warn).not.toHaveBeenCalled()
      expect(console.error).not.toHaveBeenCalled()

      expect(wrapper.props('prefetch')).toBe(true)
      expect(wrapper.props('noPrefetch')).toBe(true)
      expect(observe).not.toHaveBeenCalled()
    })
})
/* eslint-enable no-console */
