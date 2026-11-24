import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createError } from '#app/composables/error'
import NuxtClientFallbackServer from '../../packages/nuxt/src/app/components/client-fallback.server'

describe('NuxtClientFallback (server)', () => {
  it('renders the fallback when an async component nested in another async component throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const AsyncChild = defineComponent({
      async setup () {
        await new Promise(resolve => setTimeout(resolve, 10))
        throw createError({ status: 418, message: 'nested failure' })
      },
    })
    const AsyncParent = defineComponent({
      async setup () {
        await Promise.resolve()
        return () => h('div', { class: 'discarded-default' }, [h(AsyncChild)])
      },
    })
    const html = await renderToString(createSSRApp(defineComponent({
      setup: () => () => h(NuxtClientFallbackServer, null, {
        default: () => h(AsyncParent),
        fallback: () => h('p', 'nested async fallback'),
      }),
    })))
    expect(html).toContain('<p>nested async fallback</p>')
    expect(html).not.toContain('discarded-default')
    vi.restoreAllMocks()
  })
})
