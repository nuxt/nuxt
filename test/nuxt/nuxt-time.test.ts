import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { injectHead } from '#unhead/composables'

import { NuxtTime } from '#components'

describe('<NuxtTime>', () => {
  it('should not serialise data in the DOM in the client', async () => {
    const thing = await mountSuspended(
      defineComponent({
        render: () =>
          h(NuxtTime, {
            datetime: '2023-02-11T18:26:41.058Z',
            locale: 'en-GB',
            month: 'long',
            day: 'numeric',
            second: 'numeric',
            timeZone: 'UTC',
          }),
      }),
    )
    expect(thing.html()).toMatchInlineSnapshot(
      `"<time datetime="2023-02-11T18:26:41.058Z">11 February at 41</time>"`,
    )
  })

  it('should display relative time correctly', async () => {
    const datetime = Date.now() - 5 * 60 * 1000
    const thing = await mountSuspended(
      defineComponent({
        render: () =>
          h(NuxtTime, {
            datetime,
            relative: true,
          }),
      }),
    )
    expect(thing.html()).toMatchInlineSnapshot(
      `"<time datetime="${new Date(datetime).toISOString()}">5 minutes ago</time>"`,
    )
  })

  it('should display datetime in title', async () => {
    const datetime = Date.now() - 5 * 60 * 1000
    const thing = await mountSuspended(
      defineComponent({
        render: () =>
          h(NuxtTime, {
            datetime,
            relative: true,
            title: true,
          }),
      }),
    )
    expect(thing.html()).toMatchInlineSnapshot(
      `"<time datetime="${new Date(datetime).toISOString()}" title="${new Date(datetime).toISOString()}">5 minutes ago</time>"`,
    )
  })

  it('should display custom title', async () => {
    const datetime = Date.now() - 5 * 60 * 1000
    const thing = await mountSuspended(
      defineComponent({
        render: () =>
          h(NuxtTime, {
            datetime,
            relative: true,
            title: 'test',
          }),
      }),
    )
    expect(thing.html()).toMatchInlineSnapshot(
      `"<time datetime="${new Date(datetime).toISOString()}" title="test">5 minutes ago</time>"`,
    )
  })

  it('should generate the correct hydrateable code', async () => {
    const datetime = Date.now() - 32 * 24 * 60 * 60 * 1000
    const thing = await mountSuspended(
      defineComponent({
        render: () =>
          h(NuxtTime, {
            // not a defined prop, but we use to switch on ssr behaviour in test
            ssr: true,
            datetime,
            relative: true,
            title: 'test',
          }),
      }),
    )

    const html = thing.html()
    const id = html.match(/data-prehydrate-id="([^"]+)"/)?.[1]
    expect(thing.html()).toMatchInlineSnapshot(
      `"<time data-relative="true" data-title="test" datetime="${new Date(datetime).toISOString()}" title="test" ssr="true" data-prehydrate-id="${id}">1 month ago</time>"`,
    )
    const oldQuerySelector = document.querySelectorAll

    // @ts-expect-error ignoring types here
    document.querySelectorAll = (selector) => {
      if (selector === `[data-prehydrate-id*="${id}"]`) {
        return [thing.element]
      }
      return oldQuerySelector.call(document, selector)
    }

    const head = injectHead()
    // @ts-expect-error craziness
    const innerHTML = head.entries.get(1).input.script[0].innerHTML
    const fn = new Function(innerHTML)
    fn()

    expect(window._nuxtTimeNow).toBeDefined()

    expect(thing.html()).toMatchInlineSnapshot(
      `"<time data-relative="true" data-title="test" datetime="${new Date(datetime).toISOString()}" title="test" ssr="true" data-prehydrate-id="${id}">1 month ago</time>"`,
    )

    document.querySelectorAll = oldQuerySelector
  })
})
