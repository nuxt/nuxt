import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import type { ErrorReport, Frame } from 'my-bad'

import { asyncContext, isDev, isTestingAppManifest, isWebpack, nitroViteEnvironment } from './matrix'

const fixtureURL = new URL('./fixtures/dev-error-sourcemap/', import.meta.url)

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

/** 1-based position of `needle` within `file`, as it should appear in a stack frame. */
function sourcePosition (file: string, needle: string) {
  const lines = readFileSync(new URL(file, fixtureURL), 'utf8').split('\n')
  const index = lines.findIndex(line => line.includes(needle))
  if (index === -1) {
    throw new Error(`\`${needle}\` is no longer in \`${file}\`; update the fixture or the test`)
  }
  return { line: index + 1, column: lines[index]!.indexOf(needle) + 1 }
}

interface ErrorPage {
  status: number
  body: string
  /** Frames from the error serialized for `error.vue`, as `file:line:column`. */
  causeFrames: string[]
  /** The report embedded for the overlay. */
  report: ErrorReport
}

let pagePromise: Promise<ErrorPage> | undefined
function getErrorPage () {
  return pagePromise ??= renderErrorPage()
}

async function renderErrorPage (): Promise<ErrorPage> {
  const res = await fetch('/', { headers: { accept: 'text/html' } })
  const body = await res.text()
  const overlay = /<nuxt-error-overlay><\/nuxt-error-overlay>\s*<script type="application\/json">([^<]*)<\/script>/.exec(body)
  // the rest of the page is the app's own error page, with the cause serialized for `error.vue`
  const page = overlay ? body.replace(overlay[0], '') : body
  return {
    status: res.status,
    body,
    causeFrames: page.replaceAll('\\u002F', '/').match(/[^\s"'\\(]*(?:app\.vue|boom\.ts):\d+:\d+/g) ?? [],
    report: JSON.parse(overlay?.[1] ?? '{}').report,
  }
}

function frameAt (report: ErrorReport, file: string): Frame | undefined {
  return report.frames.find(frame => frame.file?.endsWith(file))
}

/** The report and every report nested under it, depth first. */
function* reports (report: ErrorReport): Generator<ErrorReport> {
  yield report
  for (const cause of report.causes) {
    yield* reports(cause)
  }
}

describe.skipIf(!runs)('dev ssr error page', () => {
  it('maps stack frames on the error cause to source positions', async () => {
    const { causeFrames } = await getErrorPage()
    const { line, column } = sourcePosition('app/utils/boom.ts', 'new Error')

    expect(causeFrames.some(frame => frame.endsWith(`app/utils/boom.ts:${line}:${column}`)), causeFrames.join('\n')).toBe(true)
  })

  it('maps the frame for the component that called the throwing composable', async () => {
    const { causeFrames } = await getErrorPage()
    const { line } = sourcePosition('app/app.vue', 'useBoom()')

    expect(causeFrames.some(frame => /app\.vue:(\d+):/.exec(frame)?.[1] === String(line)), causeFrames.join('\n')).toBe(true)
  })

  it('embeds an error report for the overlay', async () => {
    const { body, report, status } = await getErrorPage()

    expect(status).toBe(500)
    expect(body).not.toContain('data:text/html;base64')
    expect(report.message).toBe('boom from a composable')
    expect(report.frames.length).toBeGreaterThan(0)
  })

  it('reports app frames at their source positions', async () => {
    const { report } = await getErrorPage()

    expect(frameAt(report, 'app/utils/boom.ts')).toMatchObject({
      type: 'app',
      function: 'useBoom',
      ...sourcePosition('app/utils/boom.ts', 'new Error'),
    })
    expect(frameAt(report, 'app/app.vue')).toMatchObject({
      type: 'app',
      ...sourcePosition('app/app.vue', 'useBoom()'),
    })
  })

  it.skipIf(nitroViteEnvironment)('keeps the compiled position alongside the mapped one', async () => {
    const { report } = await getErrorPage()
    const frame = frameAt(report, 'app/utils/boom.ts')!

    expect(frame.compiled).toBeDefined()
    expect(frame.compiled!.line).not.toBe(frame.line)
  })

  it('reports a component that fails to compile at the position vite gives', async () => {
    const res = await fetch('/compile-error', { headers: { accept: 'text/html' } })
    const body = await res.text()
    const overlay = /<nuxt-error-overlay><\/nuxt-error-overlay>\s*<script type="application\/json">([^<]*)<\/script>/.exec(body)

    expect(res.status).toBe(500)
    expect(body.match(/<nuxt-error-overlay>/g)).toHaveLength(1)
    expect(body).not.toContain('"mode":"page"')

    const report: ErrorReport = JSON.parse(overlay![1]!).report
    const compile = [...reports(report)].find(entry => entry.kind === 'compile')
    expect(compile?.frames[0]).toMatchObject({
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
    // the render clears the channel after responding
    await expect.poll(async () => (await channelState()).current, { timeout: 5000 }).toBeUndefined()
  })
})

/** The `hello` event a freshly connected client receives. */
async function channelState (): Promise<{ current?: ErrorReport }> {
  const res = await fetch('/__nuxt_dev__/error/events', { headers: { accept: 'text/event-stream' } })
  const reader = res.body!.getReader()
  let buffer = ''
  while (!buffer.includes('\n\n')) {
    const { value, done } = await reader.read()
    if (done) {
      break
    }
    buffer += new TextDecoder().decode(value)
  }
  await reader.cancel()
  const data = /^data: (.*)$/m.exec(buffer)?.[1]
  return data ? JSON.parse(data) : {}
}
