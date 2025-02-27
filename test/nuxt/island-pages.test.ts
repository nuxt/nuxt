import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { Suspense } from 'vue'
import { createIslandPage } from '~/packages/nuxt/src/components/runtime/server-component'

vi.mock('#app/composables/error', async (og) => {
  return {
    ...(await og()),
    showError: vi.fn(),
  }
})

describe('Island pages', () => {
  it('expect to show error', async () => {
    await mountSuspended({
      setup () {
        return () => h(Suspense, {}, {
          default: () => h(createIslandPage('pagedontexist')),
        })
      },
    })
    await flushPromises()
    expect(showError).toHaveBeenCalledOnce()
  })
})
