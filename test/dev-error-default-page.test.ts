import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'

import { asyncContext, isDev, isTestingAppManifest, isWebpack } from './matrix'
import { renderErrorPage } from './dev-error-utils'

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
    const { overlay, report, status } = await renderErrorPage()

    expect(status).toBe(500)
    expect(overlay).toMatchObject({ mode: 'overlay', startMinimized: true })
    expect(report.message).toBe('boom from a composable')
    expect(report.frames[0]).toMatchObject({ file: expect.stringMatching(/app\/utils\/boom\.ts$/), line: 2, column: 9 })
  })
})
