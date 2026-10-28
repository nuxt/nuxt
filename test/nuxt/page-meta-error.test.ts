import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { createPageMetaError } from '../../packages/nuxt/src/pages/runtime/page-meta'
import { clearError, useError } from '#app/composables/error'

describe('createPageMetaError', () => {
  afterEach(async () => {
    vi.restoreAllMocks()
    await clearError()
    await navigateTo('/')
  })

  it('should fail navigation to the page with a fatal error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = useRouter()
    router.addRoute({
      name: 'page-meta-error',
      path: '/page-meta-error',
      component: defineComponent({ template: '<div />' }),
      meta: createPageMetaError(new Error('setup value')),
    })

    await expect(navigateTo('/page-meta-error')).rejects.toMatchObject({ status: 500, fatal: true })

    expect(useRoute().path).not.toBe('/page-meta-error')
    expect(useError().value).toMatchObject({ status: 500, statusText: 'NUXT_E2013', fatal: true })
    router.removeRoute('page-meta-error')
  })
})
