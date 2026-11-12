import { describe, expect, it } from 'vitest'

import { isDev, legacyErrorRendering, projectSuffix, runsOncePerViteBuilderInMatrix } from './matrix'
import { copyFixture, frameAt, renderErrorPage, sourcePosition } from './dev-error-utils'
import { setupFixture } from './utils'

const runs = isDev && (runsOncePerViteBuilderInMatrix || legacyErrorRendering)

const fixtureURL = runs
  ? copyFixture('dev-error-sourcemap', `dev error space ${projectSuffix}`)
  : new URL('./fixtures/dev-error-sourcemap/', import.meta.url)

await setupFixture(fixtureURL, runs)

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
