/**
 * Cold-start-only probe.
 *
 * The full harness takes several minutes per run, which is too slow for
 * bisecting a cold-start regression across many config permutations. This does
 * only the part that matters for that: wipe the caches, spawn `nuxt dev`, wait
 * until the port answers, kill it, repeat.
 *
 * Usage:
 *   node scripts/bench/cold-probe.ts --fixture .bench/medium --runs 3 \
 *     --variant "default:" \
 *     --variant "no-env-api:experimental: { nitroViteEnvironment: false },"
 */
import { spawn } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { performance } from 'node:perf_hooks'

const MARKER = '/* cold-probe */'

function applyPatch (configPath: string, patch: string) {
  const source = readFileSync(configPath, 'utf8')
  const escaped = MARKER.replace(/[*/]/g, '\\$&')
  const cleaned = source.replace(new RegExp(`${escaped}[\\s\\S]*?${escaped}\\n`), '')
  writeFileSync(configPath, patch
    ? cleaned.replace('export default defineNuxtConfig({', `export default defineNuxtConfig({\n  ${MARKER}\n  ${patch}\n  ${MARKER}`)
    : cleaned, 'utf8')
}

async function coldStart (fixture: string, cwd: string, port: number): Promise<number> {
  const fixtureDir = resolve(cwd, fixture)
  for (const dir of ['.nuxt', 'node_modules/.cache', 'node_modules/.vite']) {
    rmSync(resolve(fixtureDir, dir), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
  rmSync(resolve(cwd, 'node_modules/.cache/vite'), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })

  const start = performance.now()
  const child = spawn(process.execPath, [
    resolve(cwd, 'node_modules/@nuxt/cli/bin/nuxi.mjs'),
    'dev', fixture, '--no-fork', '--port', String(port),
  ], {
    cwd,
    env: { ...process.env, NODE_ENV: 'development', NUXT_TELEMETRY_DISABLED: '1', NUXT_IGNORE_LOCK: '1', FORCE_COLOR: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout!.on('data', (d) => { output += d })
  child.stderr!.on('data', (d) => { output += d })
  let exited = false
  child.on('exit', () => { exited = true })

  const deadline = performance.now() + 180_000
  let ready = 0
  while (performance.now() < deadline) {
    if (exited) { throw new Error(`dev server exited early:\n${output.slice(-2000)}`) }
    try {
      const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(2000) })
      if (res.status > 0) { await res.text(); ready = performance.now() - start; break }
    } catch { /* best effort */ }
    await new Promise(r => setTimeout(r, 20))
  }
  if (!ready) { throw new Error('timed out waiting for dev server') }

  child.kill('SIGTERM')
  await new Promise<void>((r) => {
    const t = setTimeout(() => { child.kill('SIGKILL'); r() }, 5000)
    child.on('exit', () => { clearTimeout(t); r() })
  })
  // let the port and any child processes go away before the next run
  await new Promise(r => setTimeout(r, 1500))
  return ready
}

const args = process.argv.slice(2)
const get = (flag: string, fallback?: string) => {
  const i = args.indexOf(flag)
  return i === -1 ? fallback : args[i + 1]
}
const variants = args.reduce<Array<[string, string]>>((acc, arg, i) => {
  if (arg === '--variant') {
    const raw = args[i + 1]!
    const split = raw.indexOf(':')
    acc.push([raw.slice(0, split), raw.slice(split + 1)])
  }
  return acc
}, [])
if (!variants.length) { variants.push(['default', '']) }

const fixture = get('--fixture', '.bench/medium')!
const runs = Number(get('--runs', '3'))
const cwd = process.cwd()
const configPath = resolve(cwd, fixture, 'nuxt.config.ts')
let port = Number(get('--port', '3500'))

const results: Array<[string, number[]]> = []
for (const [name, patch] of variants) {
  applyPatch(configPath, patch.trim())
  const samples: number[] = []
  for (let i = 0; i < runs; i++) {
    samples.push(await coldStart(fixture, cwd, port++))
    process.stderr.write(`  · ${name} run ${i + 1}: ${Math.round(samples.at(-1)!)}ms\n`)
  }
  results.push([name, samples])
}
applyPatch(configPath, '')

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

console.log('')
const width = Math.max(...results.map(r => r[0].length), 10)
const base = median(results[0]![1])
for (const [name, samples] of results) {
  const m = median(samples)
  const delta = name === results[0]![0] ? '' : ` (${m >= base ? '+' : ''}${(((m - base) / base) * 100).toFixed(0)}%)`
  console.log(`${name.padEnd(width)}  ${String(Math.round(m)).padStart(6)} ms${delta}   [${samples.map(s => Math.round(s)).join(', ')}]`)
}
