import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'

import { asyncContext, isDev, isTestingAppManifest, isWebpack } from './matrix'
import { frameAt, renderErrorPage, sourcePosition } from './dev-error-utils'

const fixtureURL = new URL('./fixtures/dev-error-plugin/', import.meta.url)

const runs = isDev && !isWebpack && !asyncContext && isTestingAppManifest

if (runs) {
  await setup({
    rootDir: fileURLToPath(fixtureURL),
    dev: true,
    server: true,
    browser: false,
    setupTimeout: 240 * 1000,
    serverStartTimeout: 240 * 1000,
  })
}

describe.skipIf(!runs)('a plugin that throws while its module evaluates', () => {
  it('reports the plugin frame on every request, not just the first', async () => {
    const boom = sourcePosition(fixtureURL, 'app/plugins/boom.ts', 'new Error')

    for (const attempt of [1, 2]) {
      const { report, status } = await renderErrorPage(`/?attempt=${attempt}`)

      expect(status, `attempt ${attempt}`).toBe(500)
      expect(report.frames.length, `attempt ${attempt}`).toBeGreaterThan(0)
      expect(frameAt(report, 'app/plugins/boom.ts'), `attempt ${attempt}: ${JSON.stringify(report.frames)}`).toMatchObject(boom)
    }
  })
})
