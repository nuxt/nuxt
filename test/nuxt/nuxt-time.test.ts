import { describe, expect, it, vi } from 'vitest'
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
            locale: 'en-GB',
          }),
      }),
    )
    expect(thing.html()).toMatchInlineSnapshot(
      `"<time datetime="${new Date(datetime).toISOString()}">5 minutes ago</time>"`,
    )
  })

  it('should work with relative\'s `numeric` prop', async () => {
    const datetime = Date.now() - 24 * 60 * 60 * 1000
    const thing = await mountSuspended(
      defineComponent({
        render: () =>
          h(NuxtTime, {
            datetime,
            relative: true,
            locale: 'en-GB',
            numeric: 'auto',
          }),
      }),
    )
    expect(thing.html()).toMatchInlineSnapshot(
      `"<time datetime="${new Date(datetime).toISOString()}">yesterday</time>"`,
    )
  })

  it('should work with relative\'s `relativeStyle` prop', async () => {
    const datetime = Date.now() - 5 * 60 * 1000
    const thing = await mountSuspended(
      defineComponent({
        render: () =>
          h(NuxtTime, {
            datetime,
            relative: true,
            locale: 'en-GB',
            relativeStyle: 'short',
          }),
      }),
    )
    expect(thing.html()).toMatchInlineSnapshot(
      `"<time datetime="${new Date(datetime).toISOString()}">5 min ago</time>"`,
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
            locale: 'en-GB',
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
            locale: 'en-GB',
          }),
      }),
    )
    expect(thing.html()).toMatchInlineSnapshot(
      `"<time datetime="${new Date(datetime).toISOString()}" title="test">5 minutes ago</time>"`,
    )
  })

  const tests = [
    [`${Date.now() - 25 * 60 * 60 * 1000}`, '1 day ago'],
    [`${Date.now() - 45 * 24 * 60 * 60 * 1000}`, '2 months ago'],
    [`${Date.now() - 15 * 30 * 24 * 60 * 60 * 1000}`, '1 year ago'],
  ]

  it.each(tests)('should generate the correct hydrateable code', async (_datetime,
    description) => {
    const datetime = Number(_datetime)
    const thing = await mountSuspended(
      defineComponent({
        render: () =>
          h(NuxtTime, {
            // not a defined prop, but we use to switch on ssr behaviour in test
            ssr: true,
            datetime,
            relative: true,
            title: 'test',
            locale: 'en-GB',
          }),
      }),
    )

    const html = thing.html()
    const id = html.match(/data-prehydrate-id="([^"]+)"/)?.[1]
    expect(thing.html()).toEqual(
      `<time data-locale="en-GB" data-relative="true" data-title="test" datetime="${new Date(datetime).toISOString()}" title="test" ssr="true" data-prehydrate-id="${id}">${description}</time>`,
    )

    vi.spyOn(document, 'querySelectorAll').mockImplementation((selector) => {
      if (selector === `[data-prehydrate-id*="${id}"]`) {
        return [thing.element] as any
      }
      return []
    })

    const head = injectHead()
    // @ts-expect-error craziness
    const innerHTML = head.entries.get(1).input.script[0].innerHTML
    const fn = new Function(innerHTML)
    fn()

    expect(window._nuxtTimeNow).toBeDefined()

    expect(thing.html()).toEqual(
      `<time data-locale="en-GB" data-relative="true" data-title="test" datetime="${new Date(datetime).toISOString()}" title="test" ssr="true" data-prehydrate-id="${id}">${description}</time>`,
    )

    vi.restoreAllMocks()
  })

  describe('invalid date handling', () => {
    it('should display "Invalid Date" for invalid date without relative mode', async () => {
      const thing = await mountSuspended(
        defineComponent({
          render: () =>
            h(NuxtTime, {
              datetime: 'invalid-date-string',
              locale: 'en-GB',
            }),
        }),
      )
      expect(thing.html()).toMatchInlineSnapshot(
        `"<time datetime="Invalid Date">Invalid Date</time>"`,
      )
    })

    it('should display "Invalid Date" for invalid date with relative mode', async () => {
      const thing = await mountSuspended(
        defineComponent({
          render: () =>
            h(NuxtTime, {
              datetime: 'xyz',
              relative: true,
              locale: 'en-GB',
            }),
        }),
      )
      expect(thing.html()).toMatchInlineSnapshot(
        `"<time datetime="Invalid Date">Invalid Date</time>"`,
      )
    })

    it('should fallback to current date when datetime is falsy', async () => {
      // When datetime is falsy (null, undefined, empty string), it falls back to new Date()
      const beforeMount = Date.now()
      const thing = await mountSuspended(
        defineComponent({
          render: () =>
            h(NuxtTime, {
              datetime: null as unknown as string,
              locale: 'en-GB',
              dateStyle: 'short',
              timeZone: 'UTC',
            }),
        }),
      )
      const afterMount = Date.now()
      const html = thing.html()

      // Extract the datetime attribute value
      const datetimeMatch = html.match(/datetime="([^"]+)"/)
      expect(datetimeMatch).toBeTruthy()
      const renderedDate = new Date(datetimeMatch![1]!)
      expect(renderedDate.getTime()).toBeGreaterThanOrEqual(beforeMount)
      expect(renderedDate.getTime()).toBeLessThanOrEqual(afterMount)
    })
  })
})
