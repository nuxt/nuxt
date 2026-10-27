import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { waitForHttp } from '../lib/proc.ts'
import { compareHeaders, compareRow, formatDelta, formatMs, markdownTable, summarise } from '../lib/stats.ts'
import type { SuiteContext, SuiteResult } from '../lib/suite.ts'
import { fixtureDir } from '../lib/suite.ts'
import { startDev } from './dev.ts'

export async function hmrSuite ({ targets, fixtures, reps, log }: SuiteContext): Promise<SuiteResult> {
  const rows: string[][] = []
  const headline: string[][] = []
  const data: Record<string, Record<string, number[]>> = {}

  for (const fixture of fixtures) {
    const hmr = fixture.hmr
    if (!hmr) {
      continue
    }
    log(`hmr: ${fixture.id}`)
    const servers = targets.map((target) => {
      const file = join(fixtureDir(target, fixture), hmr.file)
      return { target, file, original: readFileSync(file, 'utf8'), samples: [] as number[], ...startDev(target, fixture) }
    })
    try {
      for (const { server, url } of servers) {
        await waitForHttp(url + hmr.route, { match: hmr.text, server })
      }
      for (let rep = 0; rep <= reps; rep++) {
        for (const entry of rep % 2 ? [...servers].reverse() : servers) {
          const marker = `bench-hmr-${rep}`
          const since = performance.now()
          writeFileSync(entry.file, entry.original.replace(hmr.text, marker))
          const elapsed = await waitForHttp(entry.url + hmr.route, { match: marker, server: entry.server, since, interval: 5, timeout: 60_000 })
          if (rep > 0) {
            entry.samples.push(elapsed)
          }
          await new Promise(resolve => setTimeout(resolve, 250))
        }
      }
    } finally {
      for (const entry of servers) {
        writeFileSync(entry.file, entry.original)
        await entry.server.stop()
      }
    }

    const [baseline, head] = servers.map(s => s.samples) as [number[], number[]]
    data[fixture.id] = { baseline, head }
    rows.push(compareRow(`${fixture.id} (\`${hmr.file}\`)`, baseline, head))
    const a = summarise(baseline).median
    const b = summarise(head).median
    headline.push([`edit to updated SSR response (${fixture.id})`, formatMs(a), formatMs(b), formatDelta(a, b)])
  }

  const markdown = [
    `Time from writing a change to a component until a dev server SSR response for \`${fixtures.find(f => f.hmr)?.hmr?.route ?? '/'}\` contains it, polling every 5 ms. Both dev servers run side by side and edits alternate between them. Median of ${reps} edits after one warmup edit.`,
    '',
    markdownTable(['Fixture (edited file)', ...compareHeaders.slice(1)], rows),
  ].join('\n')

  return { markdown, headline, data }
}
