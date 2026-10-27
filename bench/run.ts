import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { environment } from './lib/env.ts'
import { fixtures as allFixtures } from './lib/fixtures.ts'
import { markdownTable } from './lib/stats.ts'
import type { SuiteContext, SuiteResult } from './lib/suite.ts'
import { fixtureDir } from './lib/suite.ts'
import { prepareTarget } from './lib/targets.ts'
import { buildSuite } from './suites/build.ts'
import { devSuite } from './suites/dev.ts'
import { footprintSuite } from './suites/footprint.ts'
import { hmrSuite } from './suites/hmr.ts'
import { modulesSuite } from './suites/modules.ts'
import { prepareSuite } from './suites/prepare.ts'
import { renderSuite } from './suites/render.ts'

const suites = {
  footprint: { title: 'Install footprint', run: footprintSuite, reps: 1 },
  modules: { title: 'Modules loaded', run: modulesSuite, reps: 1 },
  prepare: { title: '`nuxt prepare`', run: prepareSuite, reps: 10 },
  dev: { title: '`nuxt dev` startup', run: devSuite, reps: 5 },
  hmr: { title: 'Dev server updates', run: hmrSuite, reps: 20 },
  build: { title: '`nuxt build`', run: buildSuite, reps: 3 },
  render: { title: 'Production SSR throughput', run: renderSuite, reps: 5 },
} satisfies Record<string, { title: string, run: (context: SuiteContext) => Promise<SuiteResult>, reps: number }>

type SuiteName = keyof typeof suites

const { values } = parseArgs({
  options: {
    'baseline': { type: 'string', default: 'ref:origin/main' },
    'suite': { type: 'string', multiple: true },
    'fixture': { type: 'string', multiple: true },
    'reps': { type: 'string' },
    'workdir': { type: 'string', default: join(homedir(), '.cache/nuxt-bench') },
    'out': { type: 'string' },
    'help': { type: 'boolean', short: 'h' },
  },
})

if (values.help) {
  process.stdout.write(`Usage: node bench/run.ts [options]

Compares the working tree (packed from source) with a baseline, alternating runs between them.

  --baseline <spec>   ref:<git-ref> to pack from git, or an npm version, tag or alias
                      for nuxt, such as npm:nuxt-nightly@5x (default: ref:origin/main)
  --suite <name>      ${Object.keys(suites).join(', ')} (repeatable, default: all)
  --fixture <name>    ${allFixtures.map(f => f.id).join(', ')} (repeatable, default: all)
  --reps <n>          override the number of repetitions for every suite
  --workdir <dir>     install and cache directory (default: ~/.cache/nuxt-bench)
  --out <file>        markdown report path (default: <workdir>/report.md)\n`)
  process.exit(0)
}

const selectedSuites = (values.suite ?? Object.keys(suites)) as SuiteName[]
for (const name of selectedSuites) {
  if (!(name in suites)) {
    throw new Error(`unknown suite \`${name}\`; expected one of ${Object.keys(suites).join(', ')}`)
  }
}
const reps = values.reps === undefined ? undefined : Number(values.reps)
if (reps !== undefined && (!Number.isInteger(reps) || reps < 1)) {
  throw new Error(`\`--reps\` must be a positive integer, received \`${values.reps}\``)
}
const fixtures = values.fixture ? values.fixture.map(id => allFixtures.find(f => f.id === id) ?? (() => { throw new Error(`unknown fixture \`${id}\``) })()) : allFixtures
const workdir = resolve(values.workdir)
const out = resolve(values.out ?? join(workdir, 'report.md'))
const log = (message: string) => console.error(`[bench] ${message}`)

mkdirSync(workdir, { recursive: true })
const baseline = await prepareTarget('baseline', values.baseline, { workdir, log })
const head = await prepareTarget('head', 'head', { workdir, log })
const targets: SuiteContext['targets'] = [baseline, head]

for (const target of targets) {
  for (const fixture of fixtures) {
    await fixture.create(fixtureDir(target, fixture))
  }
}

const results: Record<string, SuiteResult> = {}
for (const name of selectedSuites) {
  const suite = suites[name]
  results[name] = await suite.run({ targets, fixtures, reps: reps ?? suite.reps, log })
}

const env = environment()
const header = [
  `Baseline: \`${baseline.spec}\` (\`${baseline.version}\`). Head: \`${head.version}\` plus any uncommitted changes.`,
  '',
  `Fixtures: ${fixtures.map(f => `\`${f.id}\` (${f.description})`).join('; ')}.`,
  '',
  `Node.js ${env.node} on ${env.os}, ${env.cpu} (${env.cores} cores, ${env.memory}), load average ${env.loadAverage}.`,
].join('\n')

const summary = [
  header,
  '',
  markdownTable(['Metric', 'baseline', 'head', 'delta'], selectedSuites.flatMap(name => results[name]!.headline)),
].join('\n')

const report = [
  '# Nuxt benchmark',
  '',
  summary,
  ...selectedSuites.flatMap(name => ['', `## ${suites[name].title}`, '', results[name]!.markdown]),
  '',
].join('\n')

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, report)
writeFileSync(join(dirname(out), 'summary.md'), summary + '\n')
writeFileSync(out.replace(/\.md$/, '') + '.json', JSON.stringify({
  env,
  baseline: { spec: baseline.spec, version: baseline.version },
  head: { version: head.version },
  fixtures: fixtures.map(f => f.id),
  results: Object.fromEntries(selectedSuites.map(name => [name, results[name]!.data])),
}, null, 2))

process.stdout.write(report)
log(`report written to ${out}`)
