import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { allocatePort, quietEnv, run, start, waitForHttp } from '../lib/proc.ts'
import { profileServer } from '../lib/profile.ts'
import type { Metric } from '../lib/report.ts'
import { exact, timing } from '../lib/report.ts'
import { formatDelta, formatMs, markdownTable, summarise } from '../lib/stats.ts'
import type { Fixture } from '../lib/fixtures.ts'
import type { SuiteContext, SuiteResult } from '../lib/suite.ts'
import { fixtureDir } from '../lib/suite.ts'
import type { Target } from '../lib/targets.ts'

const CONCURRENCY = 16
const DURATION = 2_000
const WARMUP_REQUESTS = 300
const PROFILE_REQUESTS = 2_000
const HEADERS = { accept: 'text/html,application/xhtml+xml' }

/** Build hashes, build ids and prerender timestamps legitimately differ between the two builds. */
const BUILD_SPECIFIC_RE = /(\/_nuxt\/)[\w.-]+(\.(?:m?js|css))|(\/_nuxt\/builds\/meta\/)[\w-]+(\.json)|("?buildId"?:")[^"]+(")|("prerenderedAt":)\d+/g

interface Round {
  requests: number
  latencies: number[]
}

/** Builds the fixture unless an earlier suite left a production build behind. */
export async function ensureBuilt (target: Target, fixture: Fixture, log: (message: string) => void): Promise<void> {
  const cwd = fixtureDir(target, fixture)
  if (!existsSync(join(cwd, '.output/server/index.mjs'))) {
    log(`building ${fixture.id} for ${target.id}`)
    await run(process.execPath, [target.bin, 'build'], { cwd, env: quietEnv, timeout: 600_000 })
  }
}

export function startProduction (target: Target, fixture: Fixture) {
  const port = allocatePort()
  const server = start(process.execPath, ['.output/server/index.mjs'], {
    cwd: fixtureDir(target, fixture),
    env: { ...quietEnv, NODE_ENV: 'production', PORT: String(port), HOST: '127.0.0.1' },
  })
  return { target, server, url: `http://127.0.0.1:${port}` }
}

async function load (url: string, match: string, duration: number): Promise<Round> {
  const latencies: number[] = []
  const deadline = performance.now() + duration
  const worker = async () => {
    while (performance.now() < deadline) {
      const started = performance.now()
      const response = await fetch(url, { headers: HEADERS })
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

function normaliseHtml (html: string): string {
  return html.replace(BUILD_SPECIFIC_RE, (_, hashDir, hashExt, metaDir, metaExt, idKey, idQuote, prerendered) => {
    if (hashDir) { return `${hashDir}HASH${hashExt}` }
    if (metaDir) { return `${metaDir}ID${metaExt}` }
    if (idKey) { return `${idKey}ID${idQuote}` }
    return `${prerendered}0`
  })
}

/** The first point where two documents diverge, with some context either side. */
function describeDifference (baseline: string, head: string): string {
  let index = 0
  while (index < baseline.length && index < head.length && baseline[index] === head[index]) { index++ }
  const excerpt = (html: string) => JSON.stringify(html.slice(Math.max(0, index - 80), index + 120))
  const fence = '```'
  return [
    `first difference at offset ${index} (${baseline.length} vs ${head.length} chars):`,
    '',
    fence,
    `baseline: ${excerpt(baseline)}`,
    `head:     ${excerpt(head)}`,
    fence,
  ].join('\n')
}

export async function renderSuite ({ targets, fixtures, reps, log, profile }: SuiteContext): Promise<SuiteResult> {
  const rows: string[][] = []
  const headline: Metric[] = []
  const data: Record<string, unknown> = {}
  const differences: string[] = []
  const profiles: string[] = []

  for (const fixture of fixtures) {
    for (const target of targets) {
      await ensureBuilt(target, fixture, message => log(`render: ${message}`))
    }

    log(`render: ${fixture.id}`)
    const servers = targets.map(target => startProduction(target, fixture))
    try {
      for (const route of fixture.routes) {
        const rounds = new Map(servers.map(s => [s, [] as Round[]]))
        const documents: string[] = []
        for (const { server, url } of servers) {
          await waitForHttp(url + route.path, { match: route.match, server, timeout: 30_000 })
          for (let i = 0; i < WARMUP_REQUESTS; i++) {
            await (await fetch(url + route.path, { headers: HEADERS })).text()
          }
          documents.push(normaliseHtml(await (await fetch(url + route.path, { headers: HEADERS })).text()))
        }
        const changed = documents[0] !== documents[1]
        headline.push(exact(`SSR html changed, \`${route.path}\` (${fixture.id})`, 0, changed ? 1 : 0, n => n ? 'changed' : 'identical'))
        if (changed) {
          differences.push(`**${fixture.id} / \`${route.path}\`**: ${describeDifference(documents[0]!, documents[1]!)}`)
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
          changed,
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
          changed ? '⚠️ changed' : 'identical',
        ])
        headline.push(timing(`SSR requests/s, \`${route.path}\` (${fixture.id})`, baseline.map(r => r.requests), head.map(r => r.requests), n => n.toFixed(0), { higherIsBetter: true }))
      }
    } finally {
      for (const { server } of servers) {
        await server.stop()
      }
    }

    if (profile) {
      for (const target of targets) {
        log(`render: profiling ${target.id} on ${fixture.id}`)
        const { markdown } = await profileServer({
          cwd: fixtureDir(target, fixture),
          routes: fixture.routes,
          requests: PROFILE_REQUESTS,
          concurrency: CONCURRENCY,
          dir: join(target.dir, `profile-${fixture.id}`),
          log,
        })
        if (markdown) {
          profiles.push(`<details>\n<summary>CPU profile: ${target.id} (\`${target.version}\`), ${fixture.id}, top frames by self time</summary>\n\n${markdown}\n\n</details>`)
        }
      }
    }
  }

  const markdown = [
    `Requests per second against the production server (\`node .output/server/index.mjs\`), ${CONCURRENCY} concurrent connections for ${DURATION / 1000} s per round, after ${WARMUP_REQUESTS} warmup requests. Both servers run side by side and rounds alternate between them. Median of ${reps} rounds; latency is the median of each round's median. The HTML each build renders for a route is also compared, ignoring build hashes and ids.`,
    '',
    markdownTable(['Fixture / route', 'baseline req/s', 'head req/s', 'delta', 'baseline min / max', 'head min / max', 'baseline latency', 'head latency', 'html'], rows),
    ...differences.length ? ['', '⚠️ The rendered HTML differs between the builds:', '', ...differences.flatMap(d => [d, ''])] : [],
    ...profiles.length ? ['', ...profiles] : [],
  ].join('\n')

  return { markdown, headline, data }
}
