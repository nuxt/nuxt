import { fetch } from '@nuxt/test-utils/e2e'
import type { ErrorReport, Frame } from 'my-bad'

export { copyFixture, sourcePosition } from './fixture-copy'

const OVERLAY_RE = /<nuxt-error-overlay><\/nuxt-error-overlay>\s*<script type="application\/json">([^<]*)<\/script>/
/** The standalone report page, served when the app could not render an error page of its own. */
const REPORT_PAGE_RE = /<script type="application\/json">(\{"mode":"page"[^<]*)<\/script>/
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
  const match = OVERLAY_RE.exec(body) ?? REPORT_PAGE_RE.exec(body)
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

/**
 * The `hello` event a page at `path` receives on connecting. A report is only announced to
 * the pages of the request it came from, so the subscription names the page it is for.
 */
export async function channelState (path = '/', base = '/__nuxt_dev__/error'): Promise<{ current?: ErrorReport }> {
  const res = await fetch(`${base}/events?path=${encodeURIComponent(path)}`, { headers: { accept: 'text/event-stream' } })
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
