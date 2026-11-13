import { describe, expect, it } from 'vitest'

import { inlineErrorRendering, isDev, runsOncePerViteBuilderInMatrix } from './matrix'
import { renderErrorPage, sourcePosition } from './dev-error-utils'
import { setupFixture } from './utils'

const fixtureURL = new URL('./fixtures/dev-error-client/', import.meta.url)

const runs = isDev && (runsOncePerViteBuilderInMatrix || inlineErrorRendering)

await setupFixture(fixtureURL, runs)

describe.skipIf(!runs)('dev error page without an app error page', () => {
  it('overlays the default error page with the report, minimised', async () => {
    const { overlay, report, status } = await renderErrorPage('/boom')

    expect(status).toBe(500)
    expect(overlay).toMatchObject({ mode: 'overlay', startMinimized: true })
    expect(report.message).toBe('boom from a composable')
    expect(report.frames[0]).toMatchObject({
      file: expect.stringMatching(/app\/utils\/boom\.ts$/),
      ...sourcePosition(fixtureURL, 'app/utils/boom.ts', 'new Error'),
    })
  })
})
