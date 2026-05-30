import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { builder, isBuilt } from './matrix'

if (builder === 'vite' && isBuilt) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/cross-origin', import.meta.url)),
    dev: false,
    server: true,
    browser: false,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(builder !== 'vite' || !isBuilt)('build asset crossOrigin', () => {
  it('renders configured crossorigin for CDN build assets', async () => {
    const html = await $fetch<string>('/')
    const assetTags = [...html.matchAll(/<(?:link|script)[^>]+(?:href|src)="https:\/\/cdn\.example\.com\/_nuxt\/[^"]+"[^>]*>/g)].map(match => match[0])

    expect(assetTags.length).toBeGreaterThan(0)
    for (const tag of assetTags) {
      expect(tag).toContain('crossorigin="use-credentials"')
    }
  })

  it('renders configured crossorigin in resource link headers', async () => {
    const response = await fetch('/')
    const linkHeader = response.headers.get('link') || ''

    expect(linkHeader).toContain('https://cdn.example.com/_nuxt/')
    expect(linkHeader).toContain('crossorigin=use-credentials')
  })
})
