import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { gzipSync } from 'node:zlib'
import { quietEnv, run } from '../lib/proc.ts'
import { compareHeaders, compareRow, formatBytes, formatDelta, formatMs, markdownTable, summarise } from '../lib/stats.ts'
import type { SuiteContext, SuiteResult } from '../lib/suite.ts'
import { fixtureDir, interleave } from '../lib/suite.ts'
import { clearBuildCache } from '../lib/targets.ts'

function files (dir: string, filter: (path: string) => boolean = () => true): string[] {
  const result: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    const path = join(entry.parentPath, entry.name)
    if (entry.isFile() && filter(path)) {
      result.push(path)
    }
  }
  return result
}

const sum = (paths: string[], size: (path: string) => number) => paths.reduce((total, path) => total + size(path), 0)

interface OutputSizes {
  clientJs: number
  clientJsGzip: number
  clientJsFiles: number
  clientCss: number
  server: number
  serverNodeModules: number
}

function outputSizes (dir: string): OutputSizes {
  const client = files(join(dir, '.output/public/_nuxt'))
  const js = client.filter(path => path.endsWith('.js'))
  const server = files(join(dir, '.output/server'))
  const isDependency = (path: string) => path.includes('/node_modules/')
  return {
    clientJs: sum(js, path => statSync(path).size),
    clientJsGzip: sum(js, path => gzipSync(readFileSync(path)).byteLength),
    clientJsFiles: js.length,
    clientCss: sum(client.filter(path => path.endsWith('.css')), path => statSync(path).size),
    server: sum(server.filter(path => !isDependency(path)), path => statSync(path).size),
    serverNodeModules: sum(server.filter(isDependency), path => statSync(path).size),
  }
}

const sizeRows: [keyof OutputSizes, string][] = [
  ['clientJs', 'client JS'],
  ['clientJsGzip', 'client JS (gzip)'],
  ['clientJsFiles', 'client JS files'],
  ['clientCss', 'client CSS'],
  ['server', 'server output, excluding `node_modules`'],
  ['serverNodeModules', 'server `node_modules`'],
]

export async function buildSuite ({ targets, fixtures, reps, log }: SuiteContext): Promise<SuiteResult> {
  const timeRows: string[][] = []
  const outputRows: string[][] = []
  const headline: string[][] = []
  const data: Record<string, unknown> = {}

  for (const fixture of fixtures) {
    log(`build: ${fixture.id}`)
    const samples = await interleave(targets, reps, async (target) => {
      const cwd = fixtureDir(target, fixture)
      clearBuildCache(cwd)
      const result = await run(process.execPath, [target.bin, 'build'], { cwd, env: quietEnv, timeout: 600_000 })
      return result.wall
    }, 0)
    const [baseline, head] = targets.map(target => samples.get(target)!) as [number[], number[]]
    timeRows.push(compareRow(fixture.id, baseline, head))
    const a = summarise(baseline).median
    const b = summarise(head).median
    headline.push([`\`nuxt build\` (${fixture.id})`, formatMs(a), formatMs(b), formatDelta(a, b)])

    const [baselineSizes, headSizes] = targets.map(target => outputSizes(fixtureDir(target, fixture))) as [OutputSizes, OutputSizes]
    for (const [key, label] of sizeRows) {
      const format = key === 'clientJsFiles' ? String : formatBytes
      outputRows.push([`${fixture.id} / ${label}`, format(baselineSizes[key]), format(headSizes[key]), formatDelta(baselineSizes[key], headSizes[key])])
    }
    headline.push([`client JS, gzip (${fixture.id})`, formatBytes(baselineSizes.clientJsGzip), formatBytes(headSizes.clientJsGzip), formatDelta(baselineSizes.clientJsGzip, headSizes.clientJsGzip)])
    data[fixture.id] = { baseline: { wall: baseline, sizes: baselineSizes }, head: { wall: head, sizes: headSizes } }
  }

  const markdown = [
    `Wall time of \`nuxt build\` with \`.nuxt\`, \`.output\` and \`node_modules/.cache\` deleted before each run. Median of ${reps} interleaved runs.`,
    '',
    markdownTable(['Fixture', ...compareHeaders.slice(1)], timeRows),
    '',
    'Output of the last build of each target.',
    '',
    markdownTable(['Fixture / output', 'baseline', 'head', 'delta'], outputRows),
  ].join('\n')

  return { markdown, headline, data }
}
