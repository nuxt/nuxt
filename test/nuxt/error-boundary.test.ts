/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { describe, expect, it } from 'vitest'

import { mount } from '@vue/test-utils'
import { NuxtErrorBoundary } from '#components'

describe('NuxtErrorBoundary', () => {
  it('should render children when there is no error', () => {
    const el = mount({
      setup () {
        return () => h('div', {}, h(NuxtErrorBoundary, {}, {
          default: () => h('span', 'default'),
          error: () => h('span', 'error'),
        }))
      },
    })
    expect(el.html()).toMatchInlineSnapshot(`"<div><span>default</span></div>"`)
    el.unmount()
  })

  it('should handle error state', async () => {
    let thrown = false
    const el = mount({
      setup () {
        return () => h('div', {}, h(NuxtErrorBoundary, {}, {
          default: () => h(defineComponent({
            setup () {
              if (!thrown) {
                thrown = true
                throw new Error('test error')
              }
              return () => h('span', 'default')
            },
          })),
          // @ts-expect-error TODO: add types for error slot
          error: ({ error, clearError }) => h('button', { onClick: () => clearError() }, error.value?.toString()),
        }))
      },
    })
    await nextTick()
    expect(el.html()).toMatchInlineSnapshot(`"<div><button>Error: test error</button></div>"`)
    await el.find('button').trigger('click')
    expect(el.html()).toMatchInlineSnapshot(`"<div><span>default</span></div>"`)
    el.unmount()
  })
})
