import process from 'node:process'
import type { Fixture } from '../lib/fixtures.ts'
import { allocatePort, quietEnv, start, waitForHttp } from '../lib/proc.ts'
import { compareHeaders, compareRow, formatDelta, formatMs, markdownTable, summarise } from '../lib/stats.ts'
import type { SuiteContext, SuiteResult } from '../lib/suite.ts'
import { fixtureDir, interleave } from '../lib/suite.ts'
import type { Target } from '../lib/targets.ts'
import { clearBuildCache } from '../lib/targets.ts'

export function startDev (target: Target, fixture: Fixture) {
  const port = allocatePort()
  const server = start(process.execPath, [target.bin, 'dev', '--port', String(port), '--host', '127.0.0.1', '--no-clear'], {
    cwd: fixtureDir(target, fixture),
    env: quietEnv,
  })
  return { server, url: `http://127.0.0.1:${port}` }
}

/** Milliseconds until each route first responds: the first route from spawn, later ones from the previous response. */
async function measure (target: Target, fixture: Fixture, cold: boolean): Promise<number[]> {
  if (cold) {
    clearBuildCache(fixtureDir(target, fixture), { output: false })
  }
  const { server, url } = startDev(target, fixture)
  try {
    const timings: number[] = []
    for (const route of fixture.routes) {
      timings.push(await waitForHttp(url + route.path, { match: route.match, server }))
    }
    return timings
  } finally {
    await server.stop()
  }
}

export async function devSuite ({ targets, fixtures, reps, log }: SuiteContext): Promise<SuiteResult> {
  const rows: string[][] = []
  const headline: string[][] = []
  const data: Record<string, Record<string, number[][]>> = {}

  for (const fixture of fixtures) {
    for (const mode of ['cold', 'warm'] as const) {
      log(`dev: ${fixture.id} (${mode})`)
      const samples = await interleave(targets, reps, target => measure(target, fixture, mode === 'cold'))
      const [baseline, head] = targets.map(target => samples.get(target)!) as [number[][], number[][]]
      data[`${fixture.id}:${mode}`] = { baseline, head }
      fixture.routes.forEach((route, index) => {
        const label = index === 0 ? `${fixture.id} / ${mode} / start to first \`${route.path}\`` : `${fixture.id} / ${mode} / then \`${route.path}\``
        rows.push(compareRow(label, baseline.map(s => s[index]!), head.map(s => s[index]!)))
      })
      if (mode === 'cold') {
        const a = summarise(baseline.map(s => s[0]!)).median
        const b = summarise(head.map(s => s[0]!)).median
        headline.push([`cold \`nuxt dev\` to first response (${fixture.id})`, formatMs(a), formatMs(b), formatDelta(a, b)])
      }
    }
  }

  const markdown = [
    `\`nuxt dev\` from process spawn until each route responds with a 200 containing its expected content. Routes are requested in order, so later routes measure the first request to a page not yet transformed. Cold runs delete \`.nuxt\` and \`node_modules/.cache\` first; warm runs keep them. Median of ${reps} interleaved runs after one warmup.`,
    '',
    markdownTable(['Fixture / mode / metric', ...compareHeaders.slice(1)], rows),
  ].join('\n')

  return { markdown, headline, data }
}
