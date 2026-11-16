/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import NuxtErrorPage from '#app/components/nuxt-error-page.vue'

async function renderDescription (error: Record<string, unknown>) {
  const wrapper = await mountSuspended(NuxtErrorPage, { props: { error } })
  const description = wrapper.find('p').text()
  wrapper.unmount()
  return description
}

describe('default error page', () => {
  it('should fall back to the status text when an unhandled error has no message', async () => {
    expect(await renderDescription({ error: true, statusCode: 500, unhandled: true, __nuxt_error: true })).toBe('Internal Server Error')
  })

  it('should fall back to custom status text when an error has no message', async () => {
    expect(await renderDescription({ statusCode: 422, statusMessage: 'Unprocessable', __nuxt_error: true })).toBe('Unprocessable')
  })
})
