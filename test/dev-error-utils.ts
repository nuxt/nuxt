import { readFileSync } from 'node:fs'
import { fetch } from '@nuxt/test-utils/e2e'
import type { ErrorReport, Frame } from 'my-bad'

const OVERLAY_RE = /<nuxt-error-overlay><\/nuxt-error-overlay>\s*<script type="application\/json">([^<]*)<\/script>/
const FRAME_RE = /[^\s"'(]*(?:app\.vue|boom\.ts):\d+:\d+/g

function causeFrames (page: string): string[] {
  return page.replaceAll('\\u002F', '/').replaceAll('\\\\', '/').replaceAll('\\', '/').match(FRAME_RE) ?? []
}

export interface ErrorPage {
  status: number
  body: string
  /** Frames from the error serialized for `error.vue`, as `file:line:column`. */
  causeFrames: string[]
  /** The overlay payload embedded in the page. */
  overlay: { mode?: string, startMinimized?: boolean, channel?: string, report: ErrorReport }
  report: ErrorReport
}

/** Render `path` and pull apart the error page it responds with. */
export async function renderErrorPage (path = '/'): Promise<ErrorPage> {
  const res = await fetch(path, { headers: { accept: 'text/html' } })
  const body = await res.text()
  const match = OVERLAY_RE.exec(body)
  const overlay = JSON.parse(match?.[1] ?? '{}')
  // what is left is the app's own error page, with the cause serialized for `error.vue`
  const page = match ? body.replace(match[0], '') : body
  return {
    status: res.status,
    body,
    causeFrames: causeFrames(page),
    overlay,
    report: overlay.report,
  }
}

/** 1-based position of `needle` within `file`, as it should appear in a stack frame. */
export function sourcePosition (fixtureURL: URL, file: string, needle: string): { line: number, column: number } {
  const lines = readFileSync(new URL(file, fixtureURL), 'utf8').split('\n')
  const index = lines.findIndex(line => line.includes(needle))
  if (index === -1) {
    throw new Error(`\`${needle}\` is no longer in \`${file}\`; update the fixture or the test`)
  }
  return { line: index + 1, column: lines[index]!.indexOf(needle) + 1 }
}

export function frameAt (report: ErrorReport, file: string): Frame | undefined {
  return report.frames.find(frame => frame.file?.replaceAll('\\', '/').endsWith(file))
}

/** The report and every report nested under it, depth first. */
export function* reports (report: ErrorReport): Generator<ErrorReport> {
  yield report
  for (const cause of report.causes) {
    yield* reports(cause)
  }
}

/** The `hello` event a client freshly connected to the live channel receives. */
export async function channelState (base = '/__nuxt_dev__/error'): Promise<{ current?: ErrorReport }> {
  const res = await fetch(`${base}/events`, { headers: { accept: 'text/event-stream' } })
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
