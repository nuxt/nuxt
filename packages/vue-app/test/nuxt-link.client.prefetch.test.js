/**
 * @jest-environment jsdom
 */
import { mount } from '@vue/test-utils'
import { compileTemplate, importComponent } from './__utils__'

describe('nuxt-link prefetch', () => {
  test('when router.prefetchLinks is set to false, link with no prop should not be prefetched',
    async (done) => {
      const compiledTemplatePath = await compileTemplate(
        'components/nuxt-link.client.js',
        'nuxt-link.client.prefetch.0.js',
        { router: { prefetchLinks: false } }
      )

      const Component = await importComponent(compiledTemplatePath)

      const methods = { observe: jest.fn() }

      const wrapper = mount(Component, {
        stubs: ['router-link'],
        methods
      })

      expect(wrapper.props('prefetch')).toBe(false)
      expect(wrapper.props('noPrefetch')).toBe(false)

      setTimeout(() => {
        expect(methods.observe).not.toHaveBeenCalled()
        done()
      }, 1)
    })

  test('when router.prefetchLinks is set to false, link with prefetch prop set to true should be prefetched',
    async (done) => {
      const compiledTemplatePath = await compileTemplate(
        'components/nuxt-link.client.js',
        'nuxt-link.client.prefetch.1.js',
        { router: { prefetchLinks: false } }
      )

      const Component = await importComponent(compiledTemplatePath)

      const methods = { observe: jest.fn() }

      const wrapper = mount(Component, {
        stubs: ['router-link'],
        propsData: { prefetch: true },
        methods
      })

      expect(wrapper.props('prefetch')).toBe(true)
      expect(wrapper.props('noPrefetch')).toBe(false)

      setTimeout(() => {
        expect(methods.observe).toHaveBeenCalled()
        done()
      }, 1)
    })

  test('when router.prefetchLinks is set to true (default), link with no prop should be prefetched',
    async (done) => {
      const compiledTemplatePath = await compileTemplate(
        'components/nuxt-link.client.js',
        'nuxt-link.client.prefetch.2.js',
        {}
      )

      const Component = await importComponent(compiledTemplatePath)

      const methods = { observe: jest.fn() }

      const wrapper = mount(Component, {
        stubs: ['router-link'],
        methods
      })

      expect(wrapper.props('prefetch')).toBe(true)
      expect(wrapper.props('noPrefetch')).toBe(false)

      setTimeout(() => {
        expect(methods.observe).toHaveBeenCalled()
        done()
      }, 1)
    })

  test('when router.prefetchLinks is set to true (default), link with prefetch prop set to false should not be prefetched',
    async (done) => {
      const compiledTemplatePath = await compileTemplate(
        'components/nuxt-link.client.js',
        'nuxt-link.client.prefetch.3.js',
        {}
      )

      const Component = await importComponent(compiledTemplatePath)

      const methods = { observe: jest.fn() }

      const wrapper = mount(Component, {
        stubs: ['router-link'],
        propsData: { prefetch: false },
        methods
      })

      expect(wrapper.props('prefetch')).toBe(false)
      expect(wrapper.props('noPrefetch')).toBe(false)

      setTimeout(() => {
        expect(methods.observe).not.toHaveBeenCalled()
        done()
      }, 1)
    })

  test('when router.prefetchLinks is set to true (default), link with noPrefetch prop should not be prefetched',
    async (done) => {
      const compiledTemplatePath = await compileTemplate(
        'components/nuxt-link.client.js',
        'nuxt-link.client.prefetch.4.js',
        {}
      )

      const Component = await importComponent(compiledTemplatePath)

      const methods = { observe: jest.fn() }

      const wrapper = mount(Component, {
        stubs: ['router-link'],
        propsData: { noPrefetch: true },
        methods
      })

      expect(wrapper.props('prefetch')).toBe(true)
      expect(wrapper.props('noPrefetch')).toBe(true)

      setTimeout(() => {
        expect(methods.observe).not.toHaveBeenCalled()
        done()
      }, 1)
    })
})
