import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, shallowRef } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { injectHead } from '#unhead/composables'

import { NuxtTime } from '#components'
import { getFormatter } from '../../packages/nuxt/src/app/components/nuxt-time-formatter'

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
    { datetime: `${Date.now() - 25 * 60 * 60 * 1000}`, description: '1 day ago' },
    { datetime: `${Date.now() - 45 * 24 * 60 * 60 * 1000}`, description: '2 months ago' },
    { datetime: `${Date.now() - 15 * 30 * 24 * 60 * 60 * 1000}`, description: '1 year ago' },
  ]

  it.each(tests)('should generate the correct hydrateable code ($description)', async ({ datetime: _datetime, description }) => {
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
    expect(id, 'data-prehydrate-id attribute should be present (onPrehydrate transform may not have run)').toBeDefined()
    expect(html).toEqual(
      `<time data-locale="en-GB" data-relative="true" data-title="test" datetime="${new Date(datetime).toISOString()}" title="test" ssr="true" data-prehydrate-id="${id}">${description}</time>`,
    )

    vi.spyOn(document, 'querySelectorAll').mockImplementation((selector) => {
      if (selector === `[data-prehydrate-id*="${id}"]`) {
        return [thing.element] as any
      }
      return []
    })

    const head = injectHead()
    const prehydrateEntry = [...head.entries.values()].find(
      // @ts-expect-error untyped internal
      e => e.input?.script?.[0]?.innerHTML?.includes('_nuxtTimeNow'),
    )
    expect(prehydrateEntry, 'onPrehydrate head entry should exist').toBeDefined()
    // @ts-expect-error untyped internal
    const fn = new Function(prehydrateEntry!.input.script[0].innerHTML)
    fn()

    expect(window._nuxtTimeNow).toBeDefined()

    expect(thing.html()).toEqual(
      `<time data-locale="en-GB" data-relative="true" data-title="test" datetime="${new Date(datetime).toISOString()}" title="test" ssr="true" data-prehydrate-id="${id}">${description}</time>`,
    )

    vi.restoreAllMocks()
  })

  it('should serialize falsy prop values like hour12=false into data attributes', async () => {
    const thing = await mountSuspended(
      defineComponent({
        render: () =>
          h(NuxtTime, {
            ssr: true,
            datetime: '2023-02-11T18:26:41.058Z',
            locale: 'en-GB',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false,
            timeZone: 'UTC',
          }),
      }),
    )
    const html = thing.html()
    expect(html).toContain('data-hour12="false"')

    // Verify round-trip: prehydrate should parse "false" back to boolean
    const id = html.match(/data-prehydrate-id="([^"]+)"/)?.[1]
    expect(id).toBeDefined()

    vi.spyOn(document, 'querySelectorAll').mockImplementation((selector) => {
      if (selector === `[data-prehydrate-id*="${id}"]`) {
        return [thing.element] as any
      }
      return []
    })

    const head = injectHead()
    const prehydrateEntry = [...head.entries.values()].find(
      // @ts-expect-error untyped internal
      e => e.input?.script?.[0]?.innerHTML?.includes('_nuxtTimeNow'),
    )
    expect(prehydrateEntry).toBeDefined()
    // @ts-expect-error untyped internal
    const fn = new Function(prehydrateEntry!.input.script[0].innerHTML)
    fn()

    // With hour12: false the formatted time should use 24-hour format
    expect(thing.element.textContent).toContain('18:26')

    vi.restoreAllMocks()
  })

  describe('invalid date handling', () => {
    it('should display "Invalid Date" and omit datetime attribute for invalid date without relative mode', async () => {
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
        `"<time>Invalid Date</time>"`,
      )
    })

    it('should display "Invalid Date" and omit datetime attribute for invalid date with relative mode', async () => {
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
        `"<time>Invalid Date</time>"`,
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

describe('<NuxtTime> formatter reuse', () => {
  it('should not construct an `Intl` formatter when only the datetime changes', async () => {
    const datetime = shallowRef('2023-02-11T18:26:41.058Z')
    const wrapper = await mountSuspended(
      defineComponent({
        render: () => h(NuxtTime, { locale: 'en-GB', dateStyle: 'short', timeZone: 'UTC', datetime: datetime.value }),
      }),
    )

    const spy = vi.spyOn(Intl, 'DateTimeFormat')
    try {
      datetime.value = '2024-03-12T18:26:41.058Z'
      await nextTick()

      expect(wrapper.html()).toContain('12/03/2024')
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  it('should share an `Intl` formatter between instances with the same options', async () => {
    const expected = [1, 2, 3].map(days => new Intl.RelativeTimeFormat('de-DE', { style: 'narrow' }).format(-days, 'day'))
    const spy = vi.spyOn(Intl, 'RelativeTimeFormat')
    try {
      const now = Date.now()
      const wrapper = await mountSuspended(
        defineComponent({
          render: () => [1, 2, 3].map(days => h(NuxtTime, { locale: 'de-DE', relative: true, relativeStyle: 'narrow', datetime: now - days * 86_400_000 })),
        }),
      )

      expect(spy).toHaveBeenCalledTimes(1)
      expect(wrapper.findAll('time').map(time => time.text())).toEqual(expected)
    } finally {
      spy.mockRestore()
    }
  })

  it('should share a formatter regardless of prop order', async () => {
    const datetime = '2023-02-11T18:26:41.058Z'
    const spy = vi.spyOn(Intl, 'DateTimeFormat')
    try {
      const wrapper = await mountSuspended(
        defineComponent({
          render: () => [
            h(NuxtTime, { datetime, locale: 'fr-FR', timeZone: 'UTC', year: 'numeric', month: 'long' }),
            h(NuxtTime, { month: 'long', locale: 'fr-FR', year: 'numeric', datetime, timeZone: 'UTC' }),
          ],
        }),
      )

      expect(spy).toHaveBeenCalledTimes(1)
      expect(new Set(wrapper.findAll('time').map(time => time.text())).size).toBe(1)
    } finally {
      spy.mockRestore()
    }
  })

  it('should keep formatters for different locales separate', async () => {
    const datetime = '2023-02-11T18:26:41.058Z'
    const options = { month: 'long', timeZone: 'UTC' }
    const locales = ['en-GB', 'de-DE', 'en-GB']
    const wrapper = await mountSuspended(
      defineComponent({
        render: () => locales.map(locale => h(NuxtTime, { datetime, locale, ...options })),
      }),
    )

    expect(wrapper.findAll('time').map(time => time.text())).toEqual(
      locales.map(locale => new Intl.DateTimeFormat(locale, options).format(new Date(datetime))),
    )
  })

  it('should evict the oldest formatter once the cache exceeds its limit', () => {
    const options = { timeZone: 'UTC' }
    const first = getFormatter(false, 'en-US', options)
    let last = first
    for (let index = 0; index < 100; index++) {
      last = getFormatter(false, `en-US-x-fmt-${index}`, options)
    }

    expect(getFormatter(false, 'en-US', options)).not.toBe(first)
    expect(getFormatter(false, 'en-US-x-fmt-99', options)).toBe(last)
  })
})
