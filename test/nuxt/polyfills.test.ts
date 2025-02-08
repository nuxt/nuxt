import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

describe('app/compat', () => {
  const Component = defineComponent({
    setup () {
      const visible = ref(false)
      setInterval(() => {
        visible.value = true
      }, 1000)

      return () => h('div', {}, visible.value ? h('span', { id: 'child' }) : {})
    },
  })
  it('setInterval is not auto-imported', async () => {
    vi.useFakeTimers()

    const wrapper = mount(Component)

    vi.advanceTimersByTime(1000)

    await wrapper.vm.$nextTick()

    expect(wrapper.find('#child').exists()).toBe(true)

    vi.useRealTimers()
  })
})
