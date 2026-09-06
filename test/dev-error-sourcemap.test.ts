import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import type { ErrorReport } from 'my-bad'

import { asyncContext, isDev, isTestingAppManifest, isWebpack, nitroViteEnvironment } from './matrix'
import { channelState, frameAt, renderErrorPage, reports, sourcePosition } from './dev-error-utils'

const fixtureURL = new URL('./fixtures/dev-error-sourcemap/', import.meta.url)
const at = (file: string, needle: string) => sourcePosition(fixtureURL, file, needle)

// stack mapping only applies in dev under the vite builders, so this runs in
// one dev project per builder
const runs = isDev && !isWebpack && !asyncContext && isTestingAppManifest

if (runs) {
  await setup({
    rootDir: fileURLToPath(fixtureURL),
    dev: true,
    server: true,
    browser: false,
    setupTimeout: 240 * 1000,
  })
}

let pagePromise: Promise<Awaited<ReturnType<typeof renderErrorPage>>> | undefined
function getErrorPage () {
  return pagePromise ??= renderErrorPage()
}

describe.skipIf(!runs)('dev ssr error page', () => {
  it('serializes the mapped cause frames for `error.vue`', async () => {
    const { causeFrames } = await getErrorPage()
    const boom = at('app/utils/boom.ts', 'new Error')

    expect(causeFrames.some(frame => frame.endsWith(`app/utils/boom.ts:${boom.line}:${boom.column}`)), causeFrames.join('\n')).toBe(true)
    expect(causeFrames.some(frame => /app\.vue:(\d+):/.exec(frame)?.[1] === String(at('app/app.vue', 'useBoom()').line)), causeFrames.join('\n')).toBe(true)
  })

  it('embeds a report whose app frames are at their source positions', async () => {
    const { body, report, status } = await getErrorPage()

    expect(status).toBe(500)
    expect(body).not.toContain('data:text/html;base64')
    expect(report.message).toBe('boom from a composable')
    expect(frameAt(report, 'app/utils/boom.ts')).toMatchObject({ type: 'app', function: 'useBoom', ...at('app/utils/boom.ts', 'new Error') })
    expect(frameAt(report, 'app/app.vue')).toMatchObject({ type: 'app', ...at('app/app.vue', 'useBoom()') })
  })

  it.skipIf(nitroViteEnvironment)('keeps the compiled position alongside the mapped one', async () => {
    const frame = frameAt((await getErrorPage()).report, 'app/utils/boom.ts')!

    expect(frame.compiled).toBeDefined()
    expect(frame.compiled!.line).not.toBe(frame.line)
  })

  it('reports a component that fails to compile at the position vite gives', async () => {
    const { body, report, status } = await renderErrorPage('/compile-error')

    expect(status).toBe(500)
    expect(body.match(/<nuxt-error-overlay>/g)).toHaveLength(1)
    expect(body).not.toContain('"mode":"page"')
    expect([...reports(report)].find(entry => entry.kind === 'compile')?.frames[0]).toMatchObject({
      file: expect.stringMatching(/app\/components\/Broken\.vue$/),
      line: 4,
      column: 4,
      snippet: expect.objectContaining({ lines: expect.arrayContaining([expect.stringContaining('</div>')]) }),
    })
  })

  it('serves the live error channel', async () => {
    const res = await fetch('/__nuxt_dev__/error/history/unknown-report')

    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/json')
  })

  it('publishes the error to the channel, and clears it once a page renders', async () => {
    const { report } = await renderErrorPage()
    expect((await channelState()).current?.id).toBe(report.id)

    const ok = await fetch('/ok', { headers: { accept: 'text/html' } })
    expect(ok.status).toBe(200)
    expect(await ok.text()).toContain('rendered without error')
    await expect.poll(async () => (await channelState()).current as ErrorReport | undefined, { timeout: 5000 }).toBeUndefined()
  })
})
