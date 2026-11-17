import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { buildRendererFixture } from '../setup-renderer-prepare.ts'

export const rendererFixtureDir = fileURLToPath(new URL('../fixtures/bench-renderer', import.meta.url))

/**
 * Build the fixture the renderer benchmark renders from. Set `NUXT_BENCH_PREBUILT` to reuse an
 * existing build, so CI can build it before the benchmarked process starts.
 */
export default async function setup (): Promise<void> {
  if (process.env.NUXT_BENCH_PREBUILT && existsSync(`${rendererFixtureDir}/.nuxt/renderer/entry.mjs`)) {
    return
  }
  await buildRendererFixture(rendererFixtureDir)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildRendererFixture(rendererFixtureDir)
}
