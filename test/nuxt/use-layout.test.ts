/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { resolveLayoutName, useLayout } from '#app/composables/layout'

function route (path: string, meta: Record<string, unknown> = {}) {
  return { path, meta } as unknown as RouteLocationNormalizedLoaded
}

describe('resolveLayoutName', () => {
  it('defaults to `default` when nothing is defined', () => {
    expect(resolveLayoutName(route('/'))).toBe('default')
  })

  it('resolves the layout defined in route meta', () => {
    expect(resolveLayoutName(route('/', { layout: 'from-meta' }))).toBe('from-meta')
  })

  it('prefers an explicit name over route meta', () => {
    expect(resolveLayoutName(route('/', { layout: 'from-meta' }), 'explicit')).toBe('explicit')
  })

  it('keeps the layout disabled when set to `false`', () => {
    expect(resolveLayoutName(route('/', { layout: false }))).toBe(false)
  })
})

describe('useLayout', () => {
  it('falls back to the layout resolved for the current route', async () => {
    const wrapper = await mountSuspended(defineComponent({
      setup: () => () => h('div', useLayout().value as string),
    }))
    expect(wrapper.text()).toBe('default')
  })
})
