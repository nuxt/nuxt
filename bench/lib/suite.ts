import { join } from 'node:path'
import type { Fixture } from './fixtures.ts'
import type { Target } from './targets.ts'

export interface SuiteContext {
  targets: [baseline: Target, head: Target]
  fixtures: Fixture[]
  reps: number
  log: (message: string) => void
}

export interface SuiteResult {
  markdown: string
  /** Headline rows of `[metric, baseline, head, delta]` for the summary table. */
  headline: string[][]
  data: unknown
}

export function fixtureDir (target: Target, fixture: Fixture): string {
  return join(target.dir, fixture.id)
}

/**
 * Run `measure` `reps` times for each target, alternating between them so drift on a shared
 * machine affects both equally. Each target gets `warmup` discarded runs first.
 */
export async function interleave<T> (targets: Target[], reps: number, measure: (target: Target) => Promise<T>, warmup = 1): Promise<Map<Target, T[]>> {
  const samples = new Map<Target, T[]>(targets.map(target => [target, []]))
  for (let i = 0; i < warmup; i++) {
    for (const target of targets) {
      await measure(target)
    }
  }
  for (let rep = 0; rep < reps; rep++) {
    const order = rep % 2 ? [...targets].reverse() : targets
    for (const target of order) {
      samples.get(target)!.push(await measure(target))
    }
  }
  return samples
}
