import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

import { isDev } from './matrix'

await setup({
  rootDir: fileURLToPath(new URL('./fixtures/nuxt-link-component-name', import.meta.url)),
  dev: isDev,
  server: true,
  browser: false,
  setupTimeout: (isWindows ? 360 : 120) * 1000,
})

describe('experimental.defaults.nuxtLink.componentName (#26718)', () => {
  it('registers the auto-imported NuxtLink under the configured name', async () => {
    const html = await $fetch<string>('/')
    // <NuxtLinkDefault> only resolves (and renders an <a>) if the registration
    // honoured `componentName`; otherwise the component is unresolved.
    expect(html).toContain('data-testid="renamed-link"')
    expect(html).toContain('href="/about"')
    expect(html).toContain('go to about')
  })
})
