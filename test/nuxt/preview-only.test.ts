import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import { usePreviewMode } from '#app/composables/preview'
import { useState } from '#app/composables/state'
import { PreviewOnly } from '#components'

describe('preview-only', () => {
  beforeEach(() => {
    resetPreviewState()
  })

  afterEach(() => {
    resetPreviewState()
  })

  it('should render fallback when preview mode is disabled', async () => {
    usePreviewMode().enabled.value = false

    const wrapper = await mountPreviewOnly()

    expect(wrapper.html()).toMatchInlineSnapshot(`"<div>fallback</div>"`)
  })

  it('should render its children when preview mode is enabled', async () => {
    usePreviewMode().enabled.value = true

    const wrapper = await mountPreviewOnly()

    expect(wrapper.html()).toMatchInlineSnapshot(`"<div>preview</div>"`)
  })

  it('should react to preview mode changes', async () => {
    const { enabled } = usePreviewMode()
    enabled.value = false

    const wrapper = await mountPreviewOnly()

    expect(wrapper.html()).toMatchInlineSnapshot(`"<div>fallback</div>"`)

    enabled.value = true
    await nextTick()

    expect(wrapper.html()).toMatchInlineSnapshot(`"<div>preview</div>"`)
  })

  it('should not initialize preview mode before custom options are applied', async () => {
    const wrapper = await mountPreviewOnly()

    expect(wrapper.html()).toMatchInlineSnapshot(`"<div>fallback</div>"`)

    usePreviewMode({
      shouldEnable: () => true,
    })

    await nextTick()
    await nextTick()

    expect(wrapper.html()).toMatchInlineSnapshot(`"<div>preview</div>"`)
  })
})

function mountPreviewOnly () {
  return mountSuspended(defineComponent({
    setup () {
      return () => h(PreviewOnly, {}, {
        default: () => h('div', {}, 'preview'),
        fallback: () => h('div', {}, 'fallback'),
      })
    },
  }))
}

function resetPreviewState () {
  useState('_preview-state', () => ({
    enabled: false,
    state: {},
  })).value = {
    enabled: false,
    state: {},
  }
}
