import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { allocatePort, quietEnv, run, start, waitForHttp } from '../lib/proc.ts'
import { formatDelta, formatMs, markdownTable, summarise } from '../lib/stats.ts'
import type { SuiteContext, SuiteResult } from '../lib/suite.ts'
import { fixtureDir } from '../lib/suite.ts'

const CONCURRENCY = 8
const DURATION = 2_000
const WARMUP_REQUESTS = 300

interface Round {
  requests: number
  latencies: number[]
}

async function load (url: string, match: string, duration: number): Promise<Round> {
  const latencies: number[] = []
  const deadline = performance.now() + duration
  const worker = async () => {
    while (performance.now() < deadline) {
      const started = performance.now()
      const response = await fetch(url)
      const body = await response.text()
      if (!response.ok || !body.includes(match)) {
        throw new Error(`unexpected ${response.status} response from ${url}`)
      }
      latencies.push(performance.now() - started)
    }
  }
  const started = performance.now()
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return { requests: latencies.length / ((performance.now() - started) / 1000), latencies }
}

export async function renderSuite ({ targets, fixtures, reps, log }: SuiteContext): Promise<SuiteResult> {
  const rows: string[][] = []
  const headline: string[][] = []
  const data: Record<string, unknown> = {}

  for (const fixture of fixtures) {
    for (const target of targets) {
      const cwd = fixtureDir(target, fixture)
      if (!existsSync(join(cwd, '.output/server/index.mjs'))) {
        log(`render: building ${fixture.id} for ${target.id}`)
        await run(process.execPath, [target.bin, 'build'], { cwd, env: quietEnv, timeout: 600_000 })
      }
    }

    log(`render: ${fixture.id}`)
    const servers = targets.map((target) => {
      const port = allocatePort()
      const server = start(process.execPath, ['.output/server/index.mjs'], {
        cwd: fixtureDir(target, fixture),
        env: { ...quietEnv, NODE_ENV: 'production', PORT: String(port), HOST: '127.0.0.1' },
      })
      return { target, server, url: `http://127.0.0.1:${port}` }
    })
    try {
      for (const route of fixture.routes) {
        const rounds = new Map(servers.map(s => [s, [] as Round[]]))
        for (const { server, url } of servers) {
          await waitForHttp(url + route.path, { match: route.match, server, timeout: 30_000 })
          for (let i = 0; i < WARMUP_REQUESTS; i++) {
            await (await fetch(url + route.path)).text()
          }
        }
        for (let rep = 0; rep < reps; rep++) {
          for (const entry of rep % 2 ? [...servers].reverse() : servers) {
            rounds.get(entry)!.push(await load(entry.url + route.path, route.match, DURATION))
          }
        }
        const [baseline, head] = servers.map(s => rounds.get(s)!) as [Round[], Round[]]
        data[`${fixture.id}:${route.path}`] = {
          baseline: baseline.map(r => r.requests),
          head: head.map(r => r.requests),
        }
        const throughput = [baseline, head].map(r => summarise(r.map(round => round.requests)))
        const latency = [baseline, head].map(r => summarise(r.map(round => summarise(round.latencies).median)).median)
        rows.push([
          `${fixture.id} / \`${route.path}\``,
          throughput[0]!.median.toFixed(0),
          throughput[1]!.median.toFixed(0),
          formatDelta(throughput[0]!.median, throughput[1]!.median),
          `${throughput[0]!.min.toFixed(0)} / ${throughput[0]!.max.toFixed(0)}`,
          `${throughput[1]!.min.toFixed(0)} / ${throughput[1]!.max.toFixed(0)}`,
          formatMs(latency[0]!),
          formatMs(latency[1]!),
        ])
        headline.push([`SSR requests/s, \`${route.path}\` (${fixture.id})`, throughput[0]!.median.toFixed(0), throughput[1]!.median.toFixed(0), formatDelta(throughput[0]!.median, throughput[1]!.median)])
      }
    } finally {
      for (const { server } of servers) {
        await server.stop()
      }
    }
  }

  const markdown = [
    `Requests per second against the production server (\`node .output/server/index.mjs\`), ${CONCURRENCY} concurrent connections for ${DURATION / 1000} s per round, after ${WARMUP_REQUESTS} warmup requests. Both servers run side by side and rounds alternate between them. Median of ${reps} rounds; latency is the median of each round's median.`,
    '',
    markdownTable(['Fixture / route', 'baseline req/s', 'head req/s', 'delta', 'baseline min / max', 'head min / max', 'baseline latency', 'head latency'], rows),
  ].join('\n')

  return { markdown, headline, data }
}
