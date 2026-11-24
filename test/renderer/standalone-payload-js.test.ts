import { describe, expect, it, vi } from 'vitest'

import { render } from './harness'

vi.mock('nuxt/internal/renderer-config', async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  NUXT_SSR_STREAMING: true,
  NUXT_RUNTIME_PAYLOAD_EXTRACTION: true,
  NUXT_PAYLOAD_INLINE: false,
  NUXT_JSON_PAYLOADS: false,
}))

describe('renderer without a server builder (js payloads)', () => {
  it('renders a payload only for a `_payload.js` url', async () => {
    const getRouteRules = () => ({ ssr: true, isr: 60 })
    const payload = await render('/about/_payload.js', { getRouteRules })
    expect(payload.response.headers.get('content-type')).toContain('text/javascript')

    for (const path of ['/about/_payload-js', '/about/_payload/js', '/about/_payloadxjs?page=2']) {
      const { response } = await render(path, { getRouteRules })
      expect(response.headers.get('content-type')).toContain('text/html')
    }
  })
})
