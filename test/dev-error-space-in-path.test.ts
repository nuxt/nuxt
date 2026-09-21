import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'

import { asyncContext, isDev, isTestingAppManifest, isWebpack, projectSuffix } from './matrix'
import { copyFixture, frameAt, renderErrorPage, sourcePosition } from './dev-error-utils'

const runs = isDev && !isWebpack && !asyncContext && isTestingAppManifest

const fixtureURL = runs
  ? copyFixture('dev-error-sourcemap', `dev error space ${projectSuffix}`)
  : new URL('./fixtures/dev-error-sourcemap/', import.meta.url)

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

describe.skipIf(!runs)('a project directory containing a space', () => {
  it('maps the throwing frame to the app source', async () => {
    const { report, status } = await renderErrorPage()

    expect(status).toBe(500)
    expect(frameAt(report, 'app/utils/boom.ts'), JSON.stringify(report.frames)).toMatchObject({
      type: 'app',
      ...sourcePosition(fixtureURL, 'app/utils/boom.ts', 'new Error'),
    })
  })
})
