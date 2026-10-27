import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { quietEnv, run } from '../lib/proc.ts'
import { formatBytes, formatDelta, markdownTable } from '../lib/stats.ts'
import type { SuiteContext, SuiteResult } from '../lib/suite.ts'
import { fixtureDir } from '../lib/suite.ts'
import { clearBuildCache } from '../lib/targets.ts'

const hook = fileURLToPath(new URL('../lib/module-hook.mjs', import.meta.url))

interface ModuleCount {
  modules: number
  bytes: number
  builtins: number
}

export async function modulesSuite ({ targets, fixtures, log }: SuiteContext): Promise<SuiteResult> {
  const rows: string[][] = []
  const headline: string[][] = []
  const data: Record<string, Record<string, ModuleCount>> = {}

  for (const fixture of fixtures) {
    log(`modules: ${fixture.id}`)
    const counts = []
    for (const target of targets) {
      const cwd = fixtureDir(target, fixture)
      clearBuildCache(cwd, { output: false })
      const result = await run(process.execPath, ['--import', hook, target.bin, 'prepare'], {
        cwd,
        env: { ...quietEnv, NODE_DISABLE_COMPILE_CACHE: '1' },
      })
      const match = result.stderr.match(/__BENCH_MODULES__(\{.*\})/)
      if (!match) {
        throw new Error(`no module stats for ${target.id} on ${fixture.id}:\n${result.stderr.slice(-2000)}`)
      }
      counts.push(JSON.parse(match[1]!) as ModuleCount)
    }
    const [baseline, head] = counts as [ModuleCount, ModuleCount]
    data[fixture.id] = { baseline, head }
    rows.push([
      fixture.id,
      String(baseline.modules),
      String(head.modules),
      formatDelta(baseline.modules, head.modules),
      formatBytes(baseline.bytes),
      formatBytes(head.bytes),
      formatDelta(baseline.bytes, head.bytes),
      String(baseline.builtins),
      String(head.builtins),
    ])
    headline.push([`modules loaded by \`nuxt prepare\` (${fixture.id})`, String(baseline.modules), String(head.modules), formatDelta(baseline.modules, head.modules)])
  }

  const markdown = [
    'JavaScript modules evaluated by `nuxt prepare`, counted with a `module.registerHooks` load hook and the compile cache disabled. Built-ins are counted separately, internals included.',
    '',
    markdownTable(['Fixture', 'baseline modules', 'head modules', 'delta', 'baseline source', 'head source', 'delta', 'baseline built-ins', 'head built-ins'], rows),
  ].join('\n')

  return { markdown, headline, data }
}
