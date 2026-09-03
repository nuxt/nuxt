import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import type { ErrorReport } from 'my-bad'

import { asyncContext, isDev, isTestingAppManifest, isWebpack } from './matrix'

const runs = isDev && !isWebpack && !asyncContext && isTestingAppManifest

if (runs) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/dev-error-default-page/', import.meta.url)),
    dev: true,
    server: true,
    browser: false,
    setupTimeout: 240 * 1000,
  })
}

describe.skipIf(!runs)('dev error page without an app error page', () => {
  it('overlays the default error page with the report, minimised', async () => {
    const res = await fetch('/', { headers: { accept: 'text/html' } })
    const body = await res.text()

    expect(res.status).toBe(500)
    expect(body).toContain('<nuxt-error-overlay>')
    expect(body).toContain('"mode":"overlay"')
    expect(body).toContain('"startMinimized":true')

    const report: ErrorReport = JSON.parse(/<script type="application\/json">([^<]*)<\/script>/.exec(body)![1]!).report
    expect(report.message).toBe('boom from a composable')
    expect(report.frames[0]).toMatchObject({ file: expect.stringMatching(/app\/utils\/boom\.ts$/), line: 2, column: 9 })
  })
})
