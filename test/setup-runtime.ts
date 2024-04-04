import { vi } from 'vitest'
import { defineEventHandler } from 'h3'

import { registerEndpoint } from '@nuxt/test-utils/runtime'

vi.mock('#app/compat/idle-callback', () => ({
  requestIdleCallback: (cb: Function) => cb()
}))

const timestamp = Date.now()
registerEndpoint('/_nuxt/builds/latest.json', defineEventHandler(() => ({
  id: 'override',
  timestamp
})))
registerEndpoint('/_nuxt/builds/meta/override.json', defineEventHandler(() => ({
  id: 'override',
  timestamp,
  matcher: {
    static: {
      '/': null,
      '/pre': null,
      '/pre/test': { redirect: true }
    },
    wildcard: { '/pre': { prerender: true } },
    dynamic: {}
  },
  prerendered: ['/specific-prerendered']
})))
