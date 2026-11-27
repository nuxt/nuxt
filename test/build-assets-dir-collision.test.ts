import { describe, expect, it } from 'vitest'
import { $fetch, fetch } from '@nuxt/test-utils/e2e'

import { isDev, runsOncePerEnvInMatrix } from './matrix'
import { setupFixture } from './utils'

const runs = isDev && runsOncePerEnvInMatrix

await setupFixture('build-assets-dir-collision', runs)

describe.skipIf(!runs)('dev server with a `buildAssetsDir` named like a source directory (#24035)', () => {
  it('renders without crashing on SSR', async () => {
    const html = await $fetch<string>('/')
    expect(html).toContain('data-testid="hello"')
    expect(html).toContain('hello world')
  })

  it('serves a plain 404 for the build assets dir root when `buildAssetsDir` has no slashes', async () => {
    const res = await fetch('/abc/')
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('Not Found')
  })
})
