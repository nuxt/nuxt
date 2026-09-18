import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import type { ErrorReport } from 'my-bad'

import { isDev, runsOncePerEnvInMatrix } from './matrix'
import { channelState, frameAt, renderErrorPage, reports, sourcePosition } from './dev-error-utils'

const fixtureURL = new URL('./fixtures/vite-server-dev-error/', import.meta.url)
const at = (file: string, needle: string) => sourcePosition(fixtureURL, file, needle)

const runs = runsOncePerEnvInMatrix && isDev

if (runs) {
  await setup({
    rootDir: fileURLToPath(fixtureURL),
    dev: true,
    server: true,
    browser: false,
    setupTimeout: 240 * 1000,
  })
}

describe.skipIf(!runs)('pure vite dev server error reporting', () => {
  it('overlays a report of the mapped stack on the app error page', async () => {
    const { body, causeFrames, overlay, report, status } = await renderErrorPage()
    const boom = at('app/utils/boom.ts', 'new Error')

    expect(status).toBe(500)
    expect(body).toContain('custom error page')
    expect(overlay).toMatchObject({ mode: 'overlay', startMinimized: true })
    expect(report.message).toBe('boom from a composable')

    expect(causeFrames.some(frame => frame.endsWith(`app/utils/boom.ts:${boom.line}:${boom.column}`)), causeFrames.join('\n')).toBe(true)
    expect(frameAt(report, 'app/utils/boom.ts')).toMatchObject({
      type: 'app',
      function: 'useBoom',
      ...boom,
      snippet: expect.objectContaining({ lines: expect.arrayContaining(['  throw new Error(\'boom from a composable\')']) }),
    })
    expect(frameAt(report, 'app/utils/boom.ts')!.compiled!.line).not.toBe(boom.line)
    expect(frameAt(report, 'app/app.vue')).toMatchObject({ type: 'app', ...at('app/app.vue', 'useBoom()') })
  })

  it('reports a component that fails to compile as a compile error', async () => {
    const { body, report, status } = await renderErrorPage('/compile-error')

    expect(status).toBe(500)
    expect(body.match(/<nuxt-error-overlay>/g)).toHaveLength(1)
    expect([...reports(report)].find(entry => entry.kind === 'compile')?.frames[0]).toMatchObject({
      file: expect.stringMatching(/app\/components\/Broken\.vue$/),
      snippet: expect.objectContaining({ lines: expect.arrayContaining([expect.stringContaining('this component does not compile')]) }),
    })
  })

  it('serves the live error channel, publishing the error and clearing it once a page renders', async () => {
    const res = await fetch('/__nuxt_dev__/error/history/unknown-report')
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/json')

    const { report } = await renderErrorPage()
    expect((await channelState()).current?.id).toBe(report.id)

    const ok = await fetch('/ok', { headers: { accept: 'text/html' } })
    expect(ok.status).toBe(200)
    expect(await ok.text()).toContain('rendered without error')
    await expect.poll(async () => (await channelState()).current as ErrorReport | undefined, { timeout: 5000 }).toBeUndefined()
  })
})
