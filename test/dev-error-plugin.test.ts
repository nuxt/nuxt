import { describe, expect, it } from 'vitest'

import { isDev, legacyErrorRendering, runsOncePerViteBuilderInMatrix } from './matrix'
import { frameAt, renderErrorPage, sourcePosition } from './dev-error-utils'
import { setupFixture } from './utils'

const fixtureURL = new URL('./fixtures/dev-error-client/', import.meta.url)

const runs = isDev && (runsOncePerViteBuilderInMatrix || legacyErrorRendering)

await setupFixture(fixtureURL, runs, { nuxtConfig: { plugins: ['~/throwing-plugin'] } })

describe.skipIf(!runs)('a plugin that throws while its module evaluates', () => {
  it('reports the plugin frame on every request, not just the first', async () => {
    const boom = sourcePosition(fixtureURL, 'app/throwing-plugin.ts', 'new Error')

    for (const attempt of [1, 2]) {
      const { report, status } = await renderErrorPage(`/?attempt=${attempt}`)

      expect(status, `attempt ${attempt}`).toBe(500)
      expect(report.frames.length, `attempt ${attempt}`).toBeGreaterThan(0)
      expect(frameAt(report, 'app/throwing-plugin.ts'), `attempt ${attempt}: ${JSON.stringify(report.frames)}`).toMatchObject(boom)
    }
  })
})
