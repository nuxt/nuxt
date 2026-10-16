import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { Component } from 'vue'
import { defineComponent, h } from 'vue'

const Probe = defineComponent({
  props: { to: { type: String, required: true }, custom: Boolean },
  setup (props) {
    const RouterLink = useNuxtApp().vueApp._context.components.RouterLink as Component
    return () => props.custom
      ? h(RouterLink, { to: props.to, custom: true }, { default: ({ href }: { href: string | null }) => h('a', { id: 'link', href }) })
      : h(RouterLink, { to: props.to, id: 'link' }, () => 'link')
  },
})

async function renderHref (to: string, custom: boolean) {
  const wrapper = await mountSuspended(Probe, { props: { to, custom } })
  return wrapper.find('#link').attributes('href')
}

describe('RouterLink without pages', () => {
  it.each([true, false])('should not render script-capable hrefs (custom: %s)', async (custom) => {
    expect(await renderHref('javascript:alert(1)', custom)).toBeUndefined()
    expect(await renderHref('\u0001javascript:alert(1)', custom)).toBeUndefined()
    expect(await renderHref('\u0001data:text/html,<script>alert(1)</script>', custom)).toBeUndefined()
    expect(await renderHref('\u0001view-source:javascript:alert(1)', custom)).toBeUndefined()
  })

  it.each([true, false])('should render safe hrefs (custom: %s)', async (custom) => {
    expect(await renderHref('/safe?a=1#b', custom)).toBe('/safe?a=1#b')
    expect(await renderHref('https://example.com', custom)).toBe('https://example.com')
  })
})
