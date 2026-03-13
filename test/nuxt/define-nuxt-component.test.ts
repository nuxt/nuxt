import { describe, expect, it } from 'vitest'
import { defineEventHandler } from 'h3'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createClientPage } from '../../packages/nuxt/src/components/runtime/client-component'
import { refreshNuxtData } from '#app/composables/asyncData'
import { NuxtPage } from '#components'
import { flushPromises } from '@vue/test-utils'

registerEndpoint('/api/hello', defineEventHandler(() => 'Hello API'))

describe('defineNuxtComponent', () => {
  it('should produce a Vue component', async () => {
    const component = defineNuxtComponent({
      render: () => h('div', 'hello world'),
    })

    const wrapper = await mountSuspended(component)
    expect(wrapper.html()).toBe('<div>hello world</div>')
  })

  it('should work with setup function', async () => {
    const component = defineNuxtComponent({
      setup () {
        const count = ref(0)
        return { count }
      },
      template: '<div>{{ count }}</div>',
    })

    const wrapper = await mountSuspended(component)
    expect(wrapper.html()).toBe('<div>0</div>')
  })

  it('should support Options API asyncData', async () => {
    const nuxtApp = useNuxtApp()
    nuxtApp.isHydrating = true
    nuxtApp.payload.serverRendered = true

    const component = defineNuxtComponent({
      asyncData: () => ({
        users: ['alice', 'bob'],
      }),
      render () {
        // @ts-expect-error this is not typed in options api
        return h('div', `Total users: ${this.users.length}`)
      },
    })

    const ClientOnlyPage = await createClientPage(() => Promise.resolve(component))
    const wrapper = await mountSuspended(ClientOnlyPage)
    expect(wrapper.html()).toBe('<div>Total users: 2</div>')

    nuxtApp.isHydrating = false
    nuxtApp.payload.serverRendered = false
  })

  it('should support asyncData with refreshNuxtData', async () => {
    let count = 0
    const component = defineNuxtComponent({
      asyncData: () => ({
        number: count++,
      }),
      template: '<div>{{ number }}</div>',
    })

    const wrapper = await mountSuspended(component)
    expect(wrapper.html()).toBe('<div>0</div>')

    await refreshNuxtData()
    await nextTick()
    expect(wrapper.html()).toBe('<div>1</div>')
  })

  it('should update reactively when asyncData properties are modified', async () => {
    const component = defineNuxtComponent({
      asyncData: () => ({ count: 0 }),
      template: '<div>{{ count }}</div>',
      mounted () {
        // @ts-expect-error count is not typed in options api
        this.count = 42
      },
    })
    const wrapper = await mountSuspended(component)
    await nextTick()
    expect(wrapper.html()).toBe('<div>42</div>')
  })

  it('should handle state and watchers correctly without duplicate updates', async () => {
    let watcherCallCount = 0

    const component = defineNuxtComponent({
      setup () {
        const state = useState('test-counter', () => 0)
        const watcher = useState('test-watcher', () => 0)

        // Should trigger once per state change
        watch(state, () => {
          watcher.value++
          watcherCallCount++
        })

        state.value++

        return {
          state,
          watcher,
          incrementState: () => state.value++,
        }
      },
      template: `
        <div>
          <button @click="incrementState">Increment</button>
          <div data-testid="state">{{ state }}</div>
          <div data-testid="watcher">{{ watcher }}</div>
        </div>
      `,
    })

    const wrapper = await mountSuspended(component)

    // Initial state: state was incremented once in setup, watcher should have triggered once
    expect(wrapper.find('[data-testid="state"]').text()).toBe('1')
    expect(wrapper.find('[data-testid="watcher"]').text()).toBe('1')
    expect(watcherCallCount).toBe(1)

    // Increment again
    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(wrapper.find('[data-testid="state"]').text()).toBe('2')
    expect(wrapper.find('[data-testid="watcher"]').text()).toBe('2')
    expect(watcherCallCount).toBe(2)
  })

  it('should work with provide/inject', async () => {
    const ParentComponent = defineComponent({
      setup () {
        provide('test-key', 'test-value')
        return () => h(ChildComponent)
      },
    })

    const ChildComponent = defineNuxtComponent({
      setup () {
        const injectedValue = inject('test-key')
        return { injectedValue }
      },
      template: '<div data-testid="injected">{{ injectedValue }}</div>',
    })

    const wrapper = await mountSuspended(ParentComponent)
    expect(wrapper.find('[data-testid="injected"]').text()).toBe('test-value')
  })

  it('should work with route information', async () => {
    const component = defineNuxtComponent({
      setup () {
        const route = useRoute()
        return {
          currentPath: computed(() => route.path),
        }
      },
      template: '<div data-testid="path">{{ currentPath }}</div>',
    })

    // The runtime environment provides a default route
    const wrapper = await mountSuspended(component)
    expect(wrapper.find('[data-testid="path"]').text()).toBe('/')
  })

  it('should handle both setup and asyncData together', async () => {
    const component = defineNuxtComponent({
      asyncData: () => ({
        serverData: 'from server',
      }),
      setup () {
        const clientData = ref('from client')
        return { clientData }
      },
      template: `
        <div>
          <div data-testid="server">{{ serverData }}</div>
          <div data-testid="client">{{ clientData }}</div>
        </div>
      `,
    })

    const wrapper = await mountSuspended(component)
    expect(wrapper.find('[data-testid="server"]').text()).toBe('from server')
    expect(wrapper.find('[data-testid="client"]').text()).toBe('from client')
  })

  it('should work without setup, asyncData, or head (passthrough)', async () => {
    const component = defineNuxtComponent({
      data () {
        return { message: 'hello' }
      },
      template: '<div>{{ message }}</div>',
    })

    const wrapper = await mountSuspended(component)
    expect(wrapper.html()).toBe('<div>hello</div>')
  })

  it('should handle component name correctly', async () => {
    const component = defineNuxtComponent({
      name: 'TestComponent',
      render: () => h('div', 'named component'),
    })

    const wrapper = await mountSuspended(component)
    expect(component.name).toBe('TestComponent')
    expect(wrapper.html()).toBe('<div>named component</div>')
  })

  it('should handle errors in asyncData gracefully', async () => {
    // Test that the component still renders even with invalid asyncData
    const component = defineNuxtComponent({
      asyncData: () => 'not an object',
      render: () => h('div', 'error test'),
    })

    const wrapper = await mountSuspended(component)
    // The component should still render successfully despite the invalid asyncData
    expect(wrapper.html()).toBe('<div>error test</div>')
  })

  it('should correctly update route information during navigation', async () => {
    const router = useRouter()

    const Route1Component = defineNuxtComponent({
      name: 'Route1Component',
      setup () {
        const route = useRoute()
        return {
          path: computed(() => route.path),
        }
      },
      template: `
        <div>
          <h1>route-1</h1>
          <div data-testid="define-nuxt-component-route-1-path">{{ path }}</div>
        </div>
      `,
    })

    const Route2Component = defineNuxtComponent({
      name: 'Route2Component',
      setup () {
        const route = useRoute()
        return {
          path: computed(() => route.path),
        }
      },
      template: `
        <div>
          <h2>route-2</h2>
          <div data-testid="define-nuxt-component-route-2-path">{{ path }}</div>
        </div>
      `,
    })

    router.addRoute({
      name: 'route1',
      path: '/define-nuxt-component/route-1',
      component: Route1Component,
    })

    router.addRoute({
      name: 'route2',
      path: '/define-nuxt-component/route-2',
      component: Route2Component,
    })

    const wrapper = await mountSuspended(NuxtPage)

    await navigateTo('/define-nuxt-component/route-1')
    await flushPromises()

    expect(wrapper.find('[data-testid="define-nuxt-component-route-1-path"]').text()).toBe('/define-nuxt-component/route-1')
    expect(wrapper.find('h1').text()).toBe('route-1')

    await navigateTo('/define-nuxt-component/route-2')
    await flushPromises()

    expect(wrapper.find('[data-testid="define-nuxt-component-route-2-path"]').text()).toBe('/define-nuxt-component/route-2')
    expect(wrapper.find('h2').text()).toBe('route-2')

    await navigateTo('/define-nuxt-component/route-1')
    await flushPromises()

    expect(wrapper.find('[data-testid="define-nuxt-component-route-1-path"]').text()).toBe('/define-nuxt-component/route-1')
    expect(wrapper.find('h1').text()).toBe('route-1')

    // Cleanup routes
    router.removeRoute('route1')
    router.removeRoute('route2')

    wrapper.unmount()
  })

  it('should support legacy async data with nested components and fetchKey', async () => {
    const ChildComponent = defineNuxtComponent({
      name: 'LegacyAsyncChild',
      asyncData () {
        return {
          fooChild: 'fooChild',
        }
      },
      template: '<div>{{ fooChild }}</div>',
    })

    const MiddleComponent = defineNuxtComponent({
      name: 'LegacyAsyncMiddle',
      asyncData () {
        return {
          fooParent: 'fooParent',
        }
      },
      template: `
        <div>
          <div>{{ fooParent }}</div>
          <ChildComponent />
        </div>
      `,
      components: { ChildComponent },
    })

    const ParentComponent = defineNuxtComponent({
      name: 'LegacyAsyncParent',
      fetchKey: () => 'hello',
      async setup () {
        await nextTick()
        useRuntimeConfig() // Test that runtime config works in setup
      },
      async asyncData () {
        await nextTick()
        return {
          hello: await $fetch('/api/hello'),
        }
      },
      template: `
        <div>
          <div>{{ hello }}</div>
          <MiddleComponent />
        </div>
      `,
      components: { MiddleComponent },
    })

    const wrapper = await mountSuspended(ParentComponent)

    expect(wrapper.html()).toContain('Hello API')
    expect(wrapper.html()).toContain('fooParent')
    expect(wrapper.html()).toContain('fooChild')

    const payloadData = useNuxtApp().payload.data

    expect(payloadData['options:asyncdata:hello']).toEqual({ hello: 'Hello API' })

    const payloadValues = Object.values(payloadData)
    expect(payloadValues).toEqual(
      expect.arrayContaining([
        { hello: 'Hello API' },
        { fooParent: 'fooParent' },
        { fooChild: 'fooChild' },
      ]),
    )
  })

  it.todo('should support head option')

  it.todo('should support head as function')
})
