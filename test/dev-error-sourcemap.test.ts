import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearServerLogs, fetch, getServerLogs } from '@nuxt/test-utils/e2e'
import type { Frame } from 'my-bad'

import { isDev, legacyErrorRendering, projectSuffix, runsOncePerViteBuilderInMatrix } from './matrix'
import { channelState, copyFixture, frameAt, renderErrorPage, reports, sourcePosition } from './dev-error-utils'
import { editFixture } from './fixture-copy'
import { setupFixture } from './utils'

// stack mapping only applies in dev under the vite builders
const runs = isDev && (runsOncePerViteBuilderInMatrix || legacyErrorRendering)

const fixtureURL = runs
  ? copyFixture('dev-error-sourcemap', `dev-error-sourcemap-${projectSuffix}`)
  : new URL('./fixtures/dev-error-sourcemap/', import.meta.url)
const at = (file: string, needle: string) => sourcePosition(fixtureURL, file, needle)

await setupFixture(fixtureURL, runs)

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

  it('keeps the compiled position alongside the mapped one', async () => {
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
      ...at('app/components/Broken.vue', '/div>'),
      snippet: expect.objectContaining({ lines: expect.arrayContaining([expect.stringContaining('</div>')]) }),
    })
  })

  it('serves the live error channel', async () => {
    const res = await fetch('/__nuxt_dev__/error/history/unknown-report')

    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/json')
  })

  it('publishes the error to the channel, and keeps it open while another page renders', async () => {
    const { report } = await renderErrorPage()
    expect((await channelState()).current?.id).toBe(report.id)

    const ok = await fetch('/ok', { headers: { accept: 'text/html' } })
    expect(ok.status).toBe(200)
    expect(await ok.text()).toContain('rendered without error')
    await new Promise(resolve => setTimeout(resolve, 500))
    expect((await channelState()).current?.id).toBe(report.id)
  })

  it('retires the error once its page streams without one', async () => {
    const { report } = await renderErrorPage('/streamed')
    expect((await channelState('/streamed')).current?.id).toBe(report.id)

    const fixed = await fetch('/streamed', { headers: { 'accept': 'text/html', 'x-boom': 'fixed' } })
    expect(fixed.headers.get('transfer-encoding')).toBe('chunked')
    expect(await fixed.text()).toContain('streamed without error')
    await expect.poll(async () => (await channelState('/streamed')).current?.id, { timeout: 5000 }).not.toBe(report.id)
  })
})

/** Wait for the dev server to flush a report for `path`, and return everything it logged. */
async function reportedLogs (path: string, options: { accept: string }) {
  clearServerLogs()
  const res = await fetch(path, { headers: { accept: options.accept } })
  await res.text()
  await expect.poll(() => getServerLogs().join('\n').includes('[request error]'), { timeout: 10_000 }).toBe(true)
  return { status: res.status, log: getServerLogs().join('\n') }
}

describe.skipIf(!runs)('dev ssr error reporting for json requests', () => {
  beforeEach(() => clearServerLogs())

  it('prints one report with a mapped server frame and a code frame for a failing api handler', async () => {
    const { log, status } = await reportedLogs('/api/boom', { accept: 'application/json' })
    const boom = at('server/api/boom.ts', 'new Error')

    expect(status).toBe(500)
    expect(log.match(/\[request error\]/g)).toHaveLength(1)
    expect(log).toContain(`server/api/boom.ts:${boom.line}:${boom.column}`)
    expect(log).toContain('│')
    expect(log).toContain('boom from an api handler')
  })

  it('prints one report with a mapped page frame for a failing page requested as json', async () => {
    const { log, status } = await reportedLogs('/boom-page', { accept: 'application/json' })
    const boom = at('app/pages/boom-page.vue', 'new Error')

    expect(status).toBe(500)
    expect(log.match(/\[request error\]/g)).toHaveLength(1)
    expect(log).toContain(`app/pages/boom-page.vue:${boom.line}:${boom.column}`)
    expect(log).toContain('│')
  })

  it('responds to a json request with json, not the error page', async () => {
    const res = await fetch('/api/boom', { headers: { accept: 'application/json' } })

    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toMatchObject({ status: 500 })
  })
})

describe.skipIf(!runs)('dev ssr errors thrown from a page', () => {
  it('reports a thrown value that carries a status code, keeping the status', async () => {
    const { body, report, status } = await renderErrorPage('/teapot')

    expect(status).toBe(418)
    expect(body.match(/<nuxt-error-overlay>/g)).toHaveLength(1)
    expect(report).toBeDefined()
  })

  it('does not report an expected fatal 404', async () => {
    const res = await fetch('/expected-404', { headers: { accept: 'text/html' } })
    const body = await res.text()

    expect(res.status).toBe(404)
    expect(body).toContain('custom error page')
    expect(body).not.toContain('<nuxt-error-overlay>')
  })

  it.each(['/expected-500', '/throw-null'])('reports a fatal 500 from %s', async (path) => {
    const { report, status } = await renderErrorPage(path)

    expect(status).toBe(500)
    expect(report).toBeDefined()
  })

  it('reports a nuxt diagnostic with its code, linked to its fix and docs', async () => {
    const { report, status } = await renderErrorPage('/diagnostic')

    expect(status).toBe(500)
    expect(report).toMatchObject({ name: 'NUXT_E1001', code: 'NUXT_E1001', docsUrl: 'https://nuxt.com/docs/5.x/errors/e1001' })
    expect(report.message).toContain('outside of a plugin')
    expect(report.hint).toContain('Move this call inside')
  })

  it('does not quote files outside `server.fs.allow` that a stack frame names', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'nuxt-dev-error-outside-'))
    const outside = join(dir, 'config.js')
    await writeFile(outside, 'export const secret = "OUTSIDE_SOURCE"\n')
    const id = `x\n    at handler (${outside}:1:1)`
    const { body, report, status } = await renderErrorPage(`/lookup?id=${encodeURIComponent(id)}`)

    const frames = [...reports(report)].flatMap(r => r.frames)
    const frameAt = (file: string) => frames.find(frame => frame.file?.replaceAll('\\', '/').endsWith(file.replaceAll('\\', '/')))
    expect(status).toBe(500)
    expect(frameAt(outside)).toBeDefined()
    expect(frameAt('app/pages/lookup.vue')?.snippet).toBeDefined()
    expect(body).not.toContain('OUTSIDE_SOURCE')
  })

  it('carries the component trace and the route of the page that threw', async () => {
    const { report } = await renderErrorPage('/boom-page')

    expect(report.trace?.map(entry => entry.label)).toContain('<boom-page>')
    expect(report.sections.find(section => section.id === 'route')?.content).toMatchObject({ path: '/boom-page' })
  })
})

describe.skipIf(!runs)('dev ssr stack mapping across edits', () => {
  const PADDING = Array.from({ length: 6 }, (_, index) => `// padding ${index}`).join('\n') + '\n'
  const fixture = editFixture(fileURLToPath(fixtureURL))

  afterEach(() => fixture.restore())

  it.each([
    ['a composable', '/', 'app/utils/boom.ts', (contents: string) => PADDING + contents],
    ['a `<script setup>` block', '/boom-page', 'app/pages/boom-page.vue', (contents: string) => contents.replace('throw new Error', PADDING + 'throw new Error')],
  ])('follows %s as lines are added above the throw and taken away again', async (_, path, file, pad) => {
    const contents = fixture.read(file)
    const start = fixture.positionOf(file, 'new Error')

    async function expectFrameAt (line: number) {
      await expect.poll(async () => frameAt((await renderErrorPage(path)).report, file)?.line, { timeout: 15_000 }).toBe(line)
      const frame: Frame = frameAt((await renderErrorPage(path)).report, file)!
      expect(frame.column).toBe(start.column)
      expect(frame.snippet?.lines[frame.line! - frame.snippet.start]).toContain('throw new Error')
    }

    await expectFrameAt(start.line)
    fixture.write(file, pad(contents))
    await expectFrameAt(start.line + 6)
    fixture.restore()
    await expectFrameAt(start.line)
  })
})
