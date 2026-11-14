import process from 'node:process'
import { quietEnv, run } from '../lib/proc.ts'
import type { Metric } from '../lib/report.ts'
import { timing } from '../lib/report.ts'
import { compareHeaders, compareRow, formatMs, markdownTable } from '../lib/stats.ts'
import type { SuiteContext, SuiteResult } from '../lib/suite.ts'
import { fixtureDir, interleave } from '../lib/suite.ts'
import { clearBuildCache } from '../lib/targets.ts'

export async function prepareSuite ({ targets, fixtures, reps, log }: SuiteContext): Promise<SuiteResult> {
  const rows: string[][] = []
  const headline: Metric[] = []
  const data: Record<string, Record<string, number[]>> = {}

  for (const fixture of fixtures) {
    log(`prepare: ${fixture.id}`)
    const samples = await interleave(targets, reps, async (target) => {
      const cwd = fixtureDir(target, fixture)
      clearBuildCache(cwd, { output: false })
      const result = await run(process.execPath, [target.bin, 'prepare'], { cwd, env: quietEnv })
      return result.wall
    })
    const [baseline, head] = targets.map(target => samples.get(target)!)
    rows.push(compareRow(fixture.id, baseline!, head!))
    data[fixture.id] = { baseline: baseline!, head: head! }
    headline.push(timing(`\`nuxt prepare\` (${fixture.id})`, baseline!, head!, formatMs))
  }

  const markdown = [
    `Wall time of \`nuxt prepare\` from process spawn to exit, with \`.nuxt\` deleted before each run. Median of ${reps} interleaved runs after one warmup, so the Node.js compile cache is warm.`,
    '',
    markdownTable(['Fixture', ...compareHeaders.slice(1)], rows),
  ].join('\n')

  return { markdown, headline, data }
}
